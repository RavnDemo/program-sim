/**
 * Calibration: how often Ravn (with bramble-agent plugged in) agrees with what the team actually decided.
 * Ground truth is the corpus index; what Ravn said is what the agent answered plus Route's decision as the Assess
 * packet carried it. Pure: reads the ledger and corpus, returns markdown.
 */
import type { Corpus } from './corpus.ts'
import type { Ledger } from './ledger.ts'
import type { AgentRecord } from './agent.ts'

type Truth = 'accept' | 'reject' | 'duplicate'
const truthOf = (outcome: string): Truth => (outcome === 'resolved' ? 'accept' : outcome === 'duplicate' ? 'duplicate' : 'reject')
const valid = (t: string) => t === 'accept' || t === 'duplicate'

function routeAction(route: any): string | undefined {
  const v = route?.value ?? route
  const a = v?.action ?? v?.decision?.action ?? v?.value?.action
  return typeof a === 'string' ? a.toUpperCase() : undefined
}

export function calibrate(c: Corpus, l: Ledger & { agent?: Record<string, AgentRecord> }) {
  const byRef = new Map(Object.entries(l.scenarios).filter(([, e]) => e.report_id).map(([id, e]) => [String(e.report_id), id]))
  const latest = new Map<string, { classify?: AgentRecord; assess?: AgentRecord }>()
  for (const r of Object.values(l.agent ?? {})) {
    if (r.code !== 'accepted' || !byRef.has(r.externalRef)) continue
    const slot = latest.get(r.externalRef) ?? {}
    if (!slot[r.stage] || slot[r.stage]!.at < r.at) slot[r.stage] = r
    latest.set(r.externalRef, slot)
  }
  const rows: { id: string; ref: string; title: string; truth: Truth; sev: string; proposed?: string; relevant?: boolean; agentSev?: string; route?: string }[] = []
  for (const [ref, slot] of latest) {
    const id = byRef.get(ref)!
    const row = c.rows.find((r) => r.id === id)!
    const a: any = slot.assess?.out
    const k: any = slot.classify?.out
    rows.push({
      id, ref, title: c.scenarios.get(id)?.title ?? '',
      truth: truthOf(row.outcome), sev: row.severity,
      proposed: a?.proposed?.value,
      relevant: k?.verdict?.isSecurityRelevant?.value,
      agentSev: a?.severity?.value ?? k?.verdict?.severity?.value,
      route: routeAction(slot.assess?.route),
    })
  }
  rows.sort((x, y) => x.id.localeCompare(y.id))
  const pct = (n: number, d: number) => (d ? `${Math.round((100 * n) / d)}% (${n}/${d})` : 'n/a')
  const withP = rows.filter((r) => r.proposed)
  const exact = withP.filter((r) => r.proposed === r.truth).length
  const binary = withP.filter((r) => valid(r.proposed!) === valid(r.truth)).length
  const withK = rows.filter((r) => r.relevant !== undefined)
  const relevantOk = withK.filter((r) => r.relevant === valid(r.truth)).length
  const withR = rows.filter((r) => r.route)
  const routeOk = withR.filter((r) => (r.route === 'ESCALATE') === valid(r.truth)).length
  const sevRows = withP.filter((r) => r.truth === 'accept' && r.agentSev)
  const sevOk = sevRows.filter((r) => r.agentSev === r.sev).length
  const miss = rows.filter((r) => (r.proposed && r.proposed !== r.truth) || (r.route && (r.route === 'ESCALATE') !== valid(r.truth)))

  const md = [
    `## Calibration — Ravn with bramble-agent vs the team`,
    ``,
    `Reports judged: **${rows.length}** of ${Object.keys(l.scenarios).length} filed.`,
    ``,
    `| measure | match |`,
    `| --- | --- |`,
    `| Agent's proposal = team's decision (accept / reject / duplicate) | ${pct(exact, withP.length)} |`,
    `| Agent's proposal, valid vs not | ${pct(binary, withP.length)} |`,
    `| Classify: security-relevant = team found it valid | ${pct(relevantOk, withK.length)} |`,
    `| Ravn's Route (escalate = valid, close = not) | ${pct(routeOk, withR.length)} |`,
    `| Severity on resolved reports | ${pct(sevOk, sevRows.length)} |`,
    ``,
    miss.length ? `### Mismatches (${miss.length})` : `### No mismatches`,
    ...(miss.length ? [``, `| scenario | report | team | agent | route | title |`, `| --- | --- | --- | --- | --- | --- |`,
      ...miss.map((r) => `| ${r.id} | [#${r.ref}](https://hackerone.com/reports/${r.ref}) | ${r.truth}${r.truth === 'accept' ? ` (${r.sev})` : ''} | ${r.proposed ?? '—'}${r.agentSev && r.proposed === 'accept' ? ` (${r.agentSev})` : ''} | ${r.route ?? '—'} | ${r.title.replace(/\|/g, '/').slice(0, 70)} |`)] : []),
  ].join('\n')
  return { md, rows }
}
