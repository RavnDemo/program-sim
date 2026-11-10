import type { Config } from './config.ts'
import type { Corpus, Scenario, Step } from './corpus.ts'
import { CLOSED } from './corpus.ts'
import type { Ledger, LedgerEntry } from './ledger.ts'
import type { H1 } from './h1.ts'
import { render } from './render.ts'
import { parseDuration, unit, iso } from './util.ts'

const WEEK = 7 * 86_400_000

export type Action =
  | { kind: 'file'; id: string; at: number; backfill: boolean }
  | { kind: 'step'; id: string; index: number; step: Step; at: number }

/** The next scenario to file, or undefined when the corpus is used up. */
export function nextUnfiled(c: Corpus, l: Ledger): string | undefined {
  return c.order.find((id) => !l.scenarios[id])
}

/** Gap before `id` arrives in steady state: per_week average, jittered by a hash of the id. */
export function arrivalGap(cfg: Config, id: string): number {
  const a = cfg.cadence.arrivals
  const avg = WEEK / a.per_week
  return avg * (1 - a.jitter + 2 * a.jitter * unit(`arrival:${id}`))
}

export function stepDue(cfg: Config, e: LedgerEntry, step: Step): number {
  return Date.parse(e.last_at) + parseDuration(step.after) * e.speed * cfg.cadence.steps.speed
}

/**
 * Run everything due at `now`, in time order, against `h1`. Mutates and returns the ledger.
 * Times chain virtually (each action's clock is when it was due, not when the tick ran), so hourly ticks
 * still produce a timeline with the corpus's own spacing.
 */
export async function tick(now: number, c: Corpus, cfg: Config, l: Ledger, h1: H1, opts: { dryRun: boolean; log?: (s: string) => void; save?: () => void }): Promise<Ledger> {
  const say = opts.log ?? (() => {})
  const record = (id: string, action: string, ok: boolean, detail?: string) =>
    l.log.push({ at: iso(now), id, action, ok, detail, ...(opts.dryRun ? { dry_run: true } : {}) })

  // 1. Arrivals.
  let filed = 0
  const backfilling = () => (l.backfill?.remaining ?? 0) > 0
  const maxFiles = backfilling() ? Math.max(1, Math.ceil(3_600_000 / parseDuration(cfg.cadence.backfill.gap))) : cfg.cadence.arrivals.max_per_tick
  while (filed < maxFiles && (backfilling() || cfg.cadence.arrivals.enabled)) {
    const id = nextUnfiled(c, l)
    if (!id) break
    const s = c.scenarios.get(id)
    if (!s) { say(`arrivals: ${id} has no scenario file yet; holding`); break }
    const gap = backfilling() ? parseDuration(cfg.cadence.backfill.gap) : arrivalGap(cfg, id)
    const due = l.last_arrival_at ? Date.parse(l.last_arrival_at) + gap : now
    if (due > now) break
    const at = Math.max(due, now - 6 * 3_600_000) // never chain from further back than 6h; a long outage doesn't flood
    try {
      const reportId = await fileScenario(s, cfg, l, h1)
      const speed = backfilling() ? cfg.cadence.backfill.speed : 1
      l.scenarios[id] = { report_id: reportId, filed_at: iso(at), speed, next_step: 0, last_at: iso(at) }
      l.last_arrival_at = iso(at)
      if (backfilling()) l.backfill!.remaining -= 1
      if (l.backfill && l.backfill.remaining <= 0) delete l.backfill
      record(id, 'file', true, `#${reportId} as ${s.row.reporter}`)
      say(`filed ${id} as ${s.row.reporter} → #${reportId}${speed !== 1 ? ` (backfill, ×${speed})` : ''}`)
      filed++
      opts.save?.()
    } catch (e) {
      record(id, 'file', false, (e as Error).message)
      say(`FAILED to file ${id}: ${(e as Error).message}`)
      break
    }
  }

  // 2. Timeline steps, earliest due first, chaining within a scenario.
  if (!cfg.cadence.steps.enabled) return l
  let ran = 0
  for (;;) {
    let best: { id: string; e: LedgerEntry; s: Scenario; step: Step; due: number } | undefined
    for (const [id, e] of Object.entries(l.scenarios)) {
      if (e.done || (e.failures ?? 0) >= 3) continue
      const s = c.scenarios.get(id)
      const step = s?.timeline[e.next_step]
      if (!s || !step) continue
      const due = stepDue(cfg, e, step)
      if (due <= now && (!best || due < best.due)) best = { id, e, s, step, due }
    }
    if (!best || ran >= cfg.cadence.steps.max_per_tick) break
    const { id, e, s, step, due } = best
    const label = `${step.by} ${step.do}${step.do === 'state' ? ` → ${step.state}` : ''}${step.do === 'severity' ? ` → ${step.rating}` : ''}${step.do === 'bounty' ? ` $${step.amount}` : ''}`
    try {
      const detail = await runStep(s, step, e, cfg, l, h1)
      e.next_step += 1
      e.last_at = iso(Math.min(due, now))
      e.failures = 0
      delete e.last_error
      if (e.next_step >= s.timeline.length) e.done = true
      record(id, label, true, detail)
      say(`${id} #${e.report_id}: ${label}${detail ? ` (${detail})` : ''}`)
      opts.save?.()
    } catch (err) {
      e.failures = (e.failures ?? 0) + 1
      e.last_error = (err as Error).message
      record(id, label, false, e.last_error)
      say(`FAILED ${id} ${label}: ${e.last_error}${e.failures >= 3 ? ' — parked after 3 failures (sim retry)' : ''}`)
      opts.save?.()
    }
    ran++
  }
  return l
}

async function fileScenario(s: Scenario, cfg: Config, l: Ledger, h1: H1): Promise<string> {
  const r = s.row
  return h1.file(r.reporter, {
    title: render(s.title, cfg, l),
    vulnerability_information: render(s.vulnerability_information, cfg, l),
    impact: render(s.impact, cfg, l),
    severity_rating: r.claimed_severity,
    weakness: r.weakness,
    asset: r.asset ? cfg.program.assets[r.asset] : undefined,
  })
}

async function runStep(s: Scenario, step: Step, e: LedgerEntry, cfg: Config, l: Ledger, h1: H1): Promise<string | undefined> {
  const id = e.report_id!
  switch (step.do) {
    case 'comment':
      if (step.by === 'reporter') return h1.reporterComment(s.row.reporter, id, render(step.message, cfg, l))
      return h1.teamComment(id, render(step.message, cfg, l), step.internal ?? false)
    case 'state': {
      const original = step.state === 'duplicate' && s.row.duplicate_of ? l.scenarios[s.row.duplicate_of]?.report_id : undefined
      if (step.state === 'duplicate' && !original) throw new Error(`original ${s.row.duplicate_of} not filed`)
      return h1.state(id, step.state, render(step.message, cfg, l), original)
    }
    case 'severity':
      return h1.severity(id, step.rating)
    case 'bounty':
      if (!cfg.cadence.bounties?.enabled) return `skipped: bounties disabled in config/cadence.yml ($${step.amount})`
      return h1.bounty(id, step.amount, render(step.message, cfg, l))
  }
}

/** Human summary of where the program stands. */
export function status(now: number, c: Corpus, cfg: Config, l: Ledger) {
  const entries = Object.entries(l.scenarios)
  const open = entries.filter(([, e]) => !e.done)
  const stuck = entries.filter(([, e]) => (e.failures ?? 0) >= 3)
  const next = nextUnfiled(c, l)
  const nextDue = next && l.last_arrival_at ? Date.parse(l.last_arrival_at) + ((l.backfill?.remaining ?? 0) > 0 ? parseDuration(cfg.cadence.backfill.gap) : arrivalGap(cfg, next)) : undefined
  return {
    program: l.program,
    filed: entries.length,
    of: c.order.length,
    timelines_running: open.length,
    stuck: stuck.map(([id, e]) => `${id}: ${e.last_error}`),
    backfill_remaining: l.backfill?.remaining ?? 0,
    next_arrival: next ? { id: next, due: nextDue ? iso(nextDue) : 'next tick' } : 'corpus used up',
    closed_by_outcome: Object.fromEntries(
      [...CLOSED].map((st) => [st, entries.filter(([id, e]) => e.done && c.scenarios.get(id)?.row.outcome === st).length]),
    ),
  }
}

/** File one scenario immediately, out of the arrival schedule (manual dispatch). */
export async function fileNow(now: number, id: string, c: Corpus, cfg: Config, l: Ledger, h1: H1, dryRun: boolean): Promise<string> {
  const s = c.scenarios.get(id)
  if (!s) throw new Error(`no scenario ${id}`)
  if (l.scenarios[id]) throw new Error(`${id} is already filed as #${l.scenarios[id].report_id}`)
  const reportId = await fileScenario(s, cfg, l, h1)
  l.scenarios[id] = { report_id: reportId, filed_at: iso(now), speed: 1, next_step: 0, last_at: iso(now) }
  l.log.push({ at: iso(now), id, action: 'file (manual)', ok: true, detail: `#${reportId}`, ...(dryRun ? { dry_run: true } : {}) })
  return reportId
}

/** Run one scenario's next step immediately, whatever its due time (manual dispatch). */
export async function stepNow(now: number, id: string, c: Corpus, cfg: Config, l: Ledger, h1: H1, dryRun: boolean): Promise<string> {
  const s = c.scenarios.get(id)
  const e = l.scenarios[id]
  if (!s || !e) throw new Error(`${id} is not filed`)
  const step = s.timeline[e.next_step]
  if (!step) throw new Error(`${id} has no steps left`)
  const detail = await runStep(s, step, e, cfg, l, h1)
  e.next_step += 1
  e.last_at = iso(now)
  if (e.next_step >= s.timeline.length) e.done = true
  const label = `${step.by} ${step.do} (manual)`
  l.log.push({ at: iso(now), id, action: label, ok: true, detail, ...(dryRun ? { dry_run: true } : {}) })
  return `${label}${detail ? ` — ${detail}` : ''}`
}
