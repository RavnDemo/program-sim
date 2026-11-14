/**
 * bramble-agent: the team's own triage tool, plugged into Ravn as a hook (pull, not push).
 *
 * Each run: ask Ravn which Classify/Assess packets are waiting for this hook (MCP list_dispatches), read each
 * report IN FULL from HackerOne with the team's token (Ravn never reads bodies; a team's own tool may), ask Claude,
 * and answer the stage with enums and numbers only — never report text, which Ravn refuses (`body_text_refused`).
 *
 * The model is given the program's policy, the report, and the program's other reports (titles, states, weakness)
 * so it can spot duplicates. It is NOT given the corpus's known outcomes: those are what calibration grades it on.
 */
import type { Config } from './config.ts'
import type { Ledger } from './ledger.ts'
import type { LiveH1 } from './h1.ts'
import type { RavnIsa } from './ravn.ts'
import { decide, MODEL } from './llm.ts'
import { iso } from './util.ts'

export interface AgentRecord {
  stage: 'classify' | 'assess'
  stageRunId: string
  attempt: number
  reportId: string
  externalRef: string
  at: string
  /** What we answered (enums/numbers), and what Ravn said back. */
  out?: unknown
  code: string
  /** Ravn's Route decision, as the Assess packet carried it (for calibration). */
  route?: unknown
}

const POLICY = `Bramble Market bug bounty program policy (summary).
In scope: the storefront https://bramble.example, its REST API https://bramble.example/api (incl. /rest, /b2b), and the source repository https://github.com/RavnDemo/bramble.
Out of scope / not applicable: denial of service and resource exhaustion testing; Web3, NFT, token and wallet features; third-party hosts and services Bramble does not own (CDNs, paste sites, email DNS like SPF/DMARC); staging hosts; self-XSS; findings with no security impact.
Informative (closed, no reward): best-practice findings without a demonstrated exploit (missing headers, version banners, clickjacking on pages without state-changing actions, logout CSRF, rate limiting with no shown impact), intentionally public files (security.txt, CSAF advisories), cosmetic issues and easter eggs.
Duplicate: same root cause as an earlier report, even if the symptom or endpoint differs (e.g. different users' security questions, different SQLi payloads on the same query).
Spam: unrelated promotional content, gibberish, or demands without a report.
Needs more info: a report that claims impact but gives no reproducible steps.
Valid reports get triaged and resolved; severity is the team's own rating, not the reporter's claim.`

const SEVERITIES = ['none', 'low', 'medium', 'high', 'critical']

const CLASSIFY_TOOL = {
  name: 'classify',
  description: 'Classify a bug bounty report for triage. Enums and numbers only; no prose.',
  input_schema: {
    type: 'object',
    properties: {
      isSecurityRelevant: { type: 'boolean', description: 'A real, in-scope security issue (even if a duplicate).' },
      severity: { type: 'string', enum: SEVERITIES, description: "The team's rating if valid, else none." },
      category: { type: 'string', description: 'lower-case slug, e.g. injection, xss, idor, auth-bypass, info-disclosure, ssrf, path-traversal, deserialization, csrf, business-logic, misconfiguration, vulnerable-component, spam, out-of-scope, best-practice' },
      isLikelyAiSlop: { type: 'boolean' },
      hasPoc: { type: 'boolean', description: 'Gives concrete reproduction steps or a working request/payload.' },
      confidence: { type: 'number', minimum: 0, maximum: 1 },
      cwe: { type: 'string', description: 'Best CWE id like CWE-89, or empty.' },
      duplicateOf: { type: 'string', description: 'HackerOne id of an EARLIER report in this program with the same root cause, or empty.' },
      proposed: { type: 'string', enum: ['accept', 'reject', 'needs-info', 'duplicate'], description: 'What the team should decide.' },
    },
    required: ['isSecurityRelevant', 'severity', 'category', 'isLikelyAiSlop', 'hasPoc', 'confidence', 'cwe', 'duplicateOf', 'proposed'],
  },
}

interface Judgement {
  isSecurityRelevant: boolean
  severity: string
  category: string
  isLikelyAiSlop: boolean
  hasPoc: boolean
  confidence: number
  cwe: string
  duplicateOf: string
  proposed: 'accept' | 'reject' | 'needs-info' | 'duplicate'
}

const slug = (s: string) => (s || 'unknown').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'unknown'

function classifyOut(j: Judgement, earlier: Set<string>) {
  const cwe = /^CWE-\d+$/i.test(j.cwe?.trim() ?? '') ? j.cwe.trim().toUpperCase() : ''
  const dup = j.duplicateOf?.replace(/[^0-9]/g, '')
  return {
    verdict: {
      isSecurityRelevant: { value: !!j.isSecurityRelevant },
      severity: { value: SEVERITIES.includes(j.severity) ? j.severity : 'none' },
      category: { value: slug(j.category) },
      isLikelyAiSlop: { value: !!j.isLikelyAiSlop },
      hasPoc: { value: !!j.hasPoc },
      confidence: { value: Math.max(0, Math.min(1, Number(j.confidence) || 0)) },
      weaknesses: cwe ? { value: [{ cwe }] } : { value: null, reason: 'not-observed' },
      products: { value: null, reason: 'not-declared' },
      duplicateOf: dup && earlier.has(dup) ? { value: dup } : { value: null, reason: 'not-observed' },
    },
    answers: { value: null, reason: 'not-declared' },
    ranBy: { model: { value: MODEL }, version: 'bramble-agent/1' },
  }
}

function assessOut(j: Judgement, url: string) {
  return {
    proposed: { value: j.proposed },
    severity: { value: SEVERITIES.includes(j.severity) ? j.severity : 'none' },
    ranBy: { tool: 'bramble-agent', version: '1' },
    card: { value: url.slice(0, 200) },
  }
}

/** One pass over everything waiting. Records every answer in `ledger.agent` (keyed by stageRunId). */
export async function runAgent(now: number, cfg: Config, l: Ledger & { agent?: Record<string, AgentRecord> }, ravn: RavnIsa, h1: LiveH1, say: (s: string) => void, opts: { max?: number } = {}) {
  l.agent ??= {}
  const asOf = iso(now)
  const { dispatches = [] } = await ravn.mcp<{ dispatches: any[] }>('list_dispatches', { asOf })
  const waiting = dispatches.filter((d) => (d.stage === 'classify' || d.stage === 'assess') && !l.agent![d.stageRunId] && !['DONE', 'FAILED', 'SKIPPED'].includes(d.stageState?.status ?? d.stageState ?? ''))
  if (!waiting.length) { say('agent: nothing waiting'); return }
  // Oldest first: Classify answers have a deadline (1h).
  waiting.sort((a, b) => Date.parse(a.queuedAt) - Date.parse(b.queuedAt))
  let others: Awaited<ReturnType<LiveH1['listReports']>> | undefined
  const cache = new Map<string, Judgement>()
  let n = 0
  for (const d of waiting) {
    if (opts.max && n >= opts.max) break
    n++
    const rec: AgentRecord = { stage: d.stage, stageRunId: d.stageRunId, attempt: d.attempt, reportId: d.reportId, externalRef: '', at: iso(Date.now()), code: 'pending' }
    try {
      const kase = await ravn.mcp<any>('get_case', { asOf, case: d.reportId })
      const env = (kase.packets ?? []).find((p: any) => p.stageRunId === d.stageRunId) ?? (kase.packets ?? []).find((p: any) => p.stage === d.stage)
      rec.externalRef = String(env?.externalRef ?? kase.externalRef ?? '')
      if (d.stage === 'assess') rec.route = env?.packet?.route
      if (!rec.externalRef) throw new Error(`no externalRef in the case; case shape: ${JSON.stringify(kase).replace(/"[0-9a-f-]{36}"/g, '"<uuid>"').slice(0, 1500)}`)
      let j = cache.get(rec.externalRef)
      if (!j) {
        const report = await h1.getReport(rec.externalRef)
        others ??= await h1.listReports()
        const earlier = others.filter((o) => o.id !== rec.externalRef && Date.parse(o.createdAt) < Date.parse(report.createdAt)).slice(0, 80)
        const user = [
          `Report #${rec.externalRef} (filed ${report.createdAt} by ${report.reporter ?? 'unknown'})`,
          `Title: ${report.title}`,
          `Reporter's severity: ${report.severity ?? 'not filed'} · weakness: ${report.weakness ?? 'not filed'} · asset: ${report.asset ?? 'not filed'}`,
          '', '## Vulnerability information', report.body.slice(0, 12000), '', '## Impact', report.impact.slice(0, 3000), '',
          '## Earlier reports in this program (id · state · weakness · title)',
          ...earlier.map((o) => `${o.id} · ${o.state} · ${o.weakness ?? '-'} · ${o.title.slice(0, 140)}`),
        ].join('\n')
        j = await decide<Judgement>(`You triage reports for the Bramble Market bug bounty program, as the security team would.\n\n${POLICY}\n\nJudge the report on its merits against the policy and the code it describes. Be skeptical of claimed severity.`, user, CLASSIFY_TOOL)
        cache.set(rec.externalRef, j)
      }
      const earlierIds = new Set((others ?? []).map((o) => o.id))
      rec.out = d.stage === 'classify' ? classifyOut(j, earlierIds) : assessOut(j, `https://hackerone.com/reports/${rec.externalRef}`)
      const r = await ravn.answer(d.stageRunId, d.attempt, rec.out)
      rec.code = r.status < 300 ? 'accepted' : `${r.code}${r.paths ? ' ' + r.paths.join(',') : ''}`
      say(`agent: ${d.stage} #${rec.externalRef} → ${d.stage === 'classify' ? `${j.isSecurityRelevant ? 'relevant' : 'not relevant'} ${j.severity}` : j.proposed} (${rec.code})`)
    } catch (e) {
      rec.code = `error: ${(e as Error).message.slice(0, 1600)}`
      say(`agent: ${d.stage} ${d.reportId} FAILED ${rec.code}`)
    }
    // A refused-for-good answer is recorded so it isn't retried; a transient error is not.
    if (!rec.code.startsWith('error')) l.agent![d.stageRunId] = rec
  }
}
