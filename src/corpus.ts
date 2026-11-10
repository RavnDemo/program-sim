import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from 'yaml'
import { parseDuration } from './util.ts'

export const STATES = ['new', 'triaged', 'needs-more-info', 'resolved', 'informative', 'not-applicable', 'duplicate', 'spam'] as const
export const CLOSED = new Set(['resolved', 'informative', 'not-applicable', 'duplicate', 'spam'])
export const RATINGS = ['none', 'low', 'medium', 'high', 'critical'] as const
export type State = (typeof STATES)[number]
export type Rating = (typeof RATINGS)[number]

/** One row of corpus/index.yml: the truth about a scenario. */
export interface IndexRow {
  id: string
  challenge?: string
  slug?: string
  name?: string
  category?: string
  difficulty?: number
  gist?: string
  reporter: string
  asset?: string
  weakness?: string
  claimed_severity: Rating
  outcome: State
  severity: Rating
  bounty: number
  duplicate_of?: string
}

export type Step =
  | { after: string; by: 'team'; do: 'comment'; message: string; internal?: boolean }
  | { after: string; by: 'reporter'; do: 'comment'; message: string }
  | { after: string; by: 'team'; do: 'state'; state: State; message?: string }
  | { after: string; by: 'team'; do: 'severity'; rating: Rating }
  | { after: string; by: 'team'; do: 'bounty'; amount: number; message?: string }

export interface ScenarioFile {
  id: string
  title: string
  vulnerability_information: string
  impact?: string
  timeline: Step[]
}

export interface Scenario extends ScenarioFile { row: IndexRow }

export interface Corpus { rows: IndexRow[]; scenarios: Map<string, Scenario>; order: string[] }

export function loadCorpus(root: string): Corpus {
  const index = parse(readFileSync(join(root, 'corpus', 'index.yml'), 'utf8')) as { scenarios: IndexRow[] }
  const rows = index.scenarios
  const dir = join(root, 'corpus', 'scenarios')
  const scenarios = new Map<string, Scenario>()
  const byId = new Map(rows.map((r) => [r.id, r]))
  if (existsSync(dir)) {
    for (const f of readdirSync(dir).filter((f) => f.endsWith('.yml')).sort()) {
      const s = parse(readFileSync(join(dir, f), 'utf8')) as ScenarioFile
      const row = byId.get(s?.id)
      if (!row) throw new Error(`${f}: id ${s?.id} has no row in corpus/index.yml`)
      if (`${s.id}.yml` !== f) throw new Error(`${f}: file name must be ${s.id}.yml`)
      scenarios.set(s.id, { ...s, row })
    }
  }
  return { rows, scenarios, order: rows.map((r) => r.id) }
}

/** Every rule from docs/corpus.md. Returns problems; empty means valid. */
export function validate(c: Corpus, assets: Record<string, string>, personas: string[]): string[] {
  const out: string[] = []
  const pos = new Map(c.order.map((id, i) => [id, i]))
  for (const r of c.rows) {
    const p = (m: string) => out.push(`${r.id}: ${m}`)
    if (!personas.includes(r.reporter)) p(`unknown reporter ${r.reporter}`)
    if (r.asset && !(r.asset in assets)) p(`unknown asset ${r.asset}`)
    if (!STATES.includes(r.outcome) || !CLOSED.has(r.outcome)) p(`outcome ${r.outcome} is not a closed state`)
    if (!RATINGS.includes(r.severity)) p(`bad severity ${r.severity}`)
    if (r.outcome === 'duplicate') {
      if (!r.duplicate_of) p('duplicate with no duplicate_of')
      else if ((pos.get(r.duplicate_of) ?? Infinity) >= pos.get(r.id)!) p(`duplicate_of ${r.duplicate_of} must come earlier`)
    }
    if (r.outcome !== 'resolved' && r.bounty) p('bounty on a report that is not resolved')
    const s = c.scenarios.get(r.id)
    if (!s) { p('no scenario file'); continue }
    if (!s.title?.trim()) p('no title')
    if (!s.vulnerability_information?.trim()) p('no vulnerability_information')
    if (!Array.isArray(s.timeline) || s.timeline.length === 0) { p('empty timeline'); continue }
    let state: string = 'new'
    let bounty = 0
    let awaitingReply = false
    s.timeline.forEach((t, i) => {
      const q = (m: string) => p(`step ${i + 1}: ${m}`)
      try { parseDuration(t.after) } catch (e) { q((e as Error).message) }
      if (t.by !== 'team' && t.by !== 'reporter') q(`bad by ${(t as Step).by}`)
      if (t.by === 'reporter' && t.do !== 'comment') q('reporters can only comment')
      if (CLOSED.has(state) && !(t.do === 'bounty' || t.do === 'comment' || (t.do === 'severity'))) q(`${t.do} after the report closed as ${state}`)
      switch (t.do) {
        case 'comment':
          if (!t.message?.trim()) q('comment with no message')
          if (t.by === 'reporter') awaitingReply = false
          break
        case 'state':
          if (!STATES.includes(t.state)) q(`bad state ${t.state}`)
          if (awaitingReply && !CLOSED.has(t.state)) q('state change while waiting on the reporter (needs-more-info)')
          awaitingReply = t.state === 'needs-more-info'
          state = t.state
          break
        case 'severity':
          if (!RATINGS.includes(t.rating)) q(`bad rating ${t.rating}`)
          break
        case 'bounty':
          if (state !== 'resolved') q('bounty before resolved')
          bounty += Number(t.amount) || 0
          break
        default:
          q(`unknown action ${(t as { do: string }).do}`)
      }
    })
    if (state !== r.outcome) p(`timeline ends in ${state}, index says ${r.outcome}`)
    if (bounty !== (r.bounty ?? 0)) p(`bounties sum to ${bounty}, index says ${r.bounty}`)
    if (r.outcome === 'duplicate') {
      const last = [...s.timeline].reverse().find((t) => t.do === 'state') as { message?: string }
      if (!last?.message?.includes(`{{report:${r.duplicate_of}}}`)) p(`duplicate close must reference {{report:${r.duplicate_of}}}`)
    }
    const { row: _row, ...own } = s
    const text = JSON.stringify(own) // what gets sent; the index row is internal
    for (const ref of text.matchAll(/\{\{report:([A-Z]+-\d+)\}\}/g)) {
      if ((pos.get(ref[1]) ?? Infinity) >= pos.get(r.id)!) p(`references ${ref[1]}, which is filed later`)
    }
    for (const bad of text.matchAll(/\{\{(?!report:|base_url\}\}|source_url\}\}|program\}\})([^}]*)\}\}/g)) p(`unknown placeholder {{${bad[1]}}}`)
    if (/juice[\s-]?shop|owasp juice|juice-sh\.op/i.test(text)) p('mentions Juice Shop; Bramble Market is the only name hackers see')
  }
  for (const id of c.scenarios.keys()) if (!c.rows.some((r) => r.id === id)) out.push(`${id}: scenario file with no index row`)
  return out
}
