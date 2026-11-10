import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

/** What has happened so far. The only mutable state; it lives on the `ledger` branch as ledger.json. */
export interface Ledger {
  version: 1
  program: string
  /** When the most recent report was filed (arrival clock). */
  last_arrival_at?: string
  /** Backfill in progress: how many more to file, and the speed their timelines run at. */
  backfill?: { remaining: number }
  scenarios: Record<string, LedgerEntry>
  /** Append-only action log, newest last. */
  log: LogLine[]
}

export interface LedgerEntry {
  report_id?: string
  filed_at: string
  /** Timelines of reports filed during backfill run faster; fixed at filing. */
  speed: number
  /** Index of the next timeline step to run. */
  next_step: number
  /** When the previous step (or the filing) happened — the next step's `after` counts from here. */
  last_at: string
  done?: boolean
  failures?: number
  last_error?: string
}

export interface LogLine { at: string; id: string; action: string; ok: boolean; detail?: string; dry_run?: boolean }

export function emptyLedger(program: string): Ledger {
  return { version: 1, program, scenarios: {}, log: [] }
}

export function readLedger(path: string, program: string): Ledger {
  if (!existsSync(path)) return emptyLedger(program)
  const l = JSON.parse(readFileSync(path, 'utf8')) as Ledger
  if (l.program !== program) throw new Error(`ledger ${path} belongs to program ${l.program}, not ${program}`)
  return l
}

export function writeLedger(path: string, l: Ledger): void {
  mkdirSync(dirname(path), { recursive: true })
  if (l.log.length > 5000) l.log = l.log.slice(-5000)
  writeFileSync(path, JSON.stringify(l, null, 2) + '\n')
}
