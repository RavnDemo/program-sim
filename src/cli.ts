#!/usr/bin/env node
/**
 * program-sim — works the Bramble Market HackerOne sandbox program, deterministically.
 *
 *   node src/cli.ts validate                    check the corpus against docs/corpus.md
 *   node src/cli.ts status                      where the program stands
 *   node src/cli.ts tick [--live]               run everything due now (dry run unless --live)
 *   node src/cli.ts backfill <n> [--live]       start a fast backfill of the next n reports (runs on following ticks)
 *   node src/cli.ts file <id> [--live]          file one scenario now, out of turn
 *   node src/cli.ts step <id> [--live]          run one scenario's next timeline step now
 *   node src/cli.ts retry <id|all>              clear a parked scenario's failures (all: every failing one)
 *   node src/cli.ts simulate <duration>         dry-run the program forward in virtual time (e.g. 60d) and summarise
 *   node src/cli.ts check [--live]              resolve scopes/weaknesses and check every token (no writes)
 *
 * Options: --ledger <path> (default .ledger/ledger.json; dry runs use .ledger/dry-run.json), --now <ISO>.
 */
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadConfig } from './config.ts'
import { loadCorpus, validate } from './corpus.ts'
import { readLedger, writeLedger, emptyLedger } from './ledger.ts'
import { tick, status, fileNow, stepNow } from './engine.ts'
import { DryRunH1, LiveH1, type H1 } from './h1.ts'
import { iso, parseDuration } from './util.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const argv = process.argv.slice(2)
const flag = (n: string) => argv.includes(`--${n}`)
const opt = (n: string) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : undefined }
const positional = argv.filter((a, i) => !a.startsWith('--') && !(i > 0 && ['--ledger', '--now'].includes(argv[i - 1])))
const [cmd, arg] = positional

const live = flag('live') || process.env.SIM_LIVE === '1'
const cfg = loadConfig(root)
const corpus = loadCorpus(root)
const handle = cfg.program.program.handle
const ledgerPath = opt('ledger') ?? join(root, '.ledger', live ? 'ledger.json' : 'dry-run.json')
const now = opt('now') ? Date.parse(opt('now')!) : process.env.SIM_NOW ? Date.parse(process.env.SIM_NOW) : Date.now()
const log = (s: string) => console.log(s)

function h1(): H1 {
  return live ? new LiveH1(cfg) : new DryRunH1(log)
}

async function main() {
  switch (cmd) {
    case 'validate': {
      const problems = validate(corpus, cfg.program.assets, Object.keys(cfg.personas.hackers))
      for (const p of problems) console.log(p)
      console.log(problems.length ? `${problems.length} problem(s)` : `corpus OK: ${corpus.rows.length} scenarios, ${corpus.scenarios.size} written`)
      process.exit(problems.length ? 1 : 0)
    }
    case 'status': {
      const l = readLedger(ledgerPath, handle)
      console.log(JSON.stringify(status(now, corpus, cfg, l), null, 2))
      return
    }
    case 'tick': {
      const l = readLedger(ledgerPath, handle)
      const save = () => writeLedger(ledgerPath, l)
      console.log(`tick ${iso(now)} ${live ? 'LIVE' : 'dry run'} · ledger ${ledgerPath}`)
      await tick(now, corpus, cfg, l, h1(), { dryRun: !live, log, save })
      save()
      return
    }
    case 'backfill': {
      const n = Number(arg ?? cfg.cadence.backfill.count)
      const l = readLedger(ledgerPath, handle)
      l.backfill = { remaining: n }
      writeLedger(ledgerPath, l)
      console.log(`backfill armed: next ${n} reports file every ${cfg.cadence.backfill.gap}, timelines at ×${cfg.cadence.backfill.speed}`)
      return
    }
    case 'file':
    case 'step': {
      if (!arg) throw new Error(`${cmd} needs a scenario id`)
      const l = readLedger(ledgerPath, handle)
      const out = cmd === 'file'
        ? `filed ${arg} → #${await fileNow(now, arg, corpus, cfg, l, h1(), !live)}`
        : `${arg}: ${await stepNow(now, arg, corpus, cfg, l, h1(), !live)}`
      writeLedger(ledgerPath, l)
      console.log(out)
      return
    }
    case 'retry': {
      const l = readLedger(ledgerPath, handle)
      const ids = arg === 'all' || !arg ? Object.keys(l.scenarios).filter((id) => l.scenarios[id].failures) : [arg]
      for (const id of ids) {
        const e = l.scenarios[id]
        if (!e) throw new Error(`${id} is not filed`)
        e.failures = 0
        delete e.last_error
        delete e.retry_after
      }
      writeLedger(ledgerPath, l)
      console.log(`unparked: ${ids.join(', ') || 'nothing'}`)
      return
    }
    case 'simulate': {
      const span = parseDuration(arg ?? '30d')
      const l = emptyLedger(handle)
      if (flag('backfill')) l.backfill = { remaining: cfg.cadence.backfill.count }
      const sink = new DryRunH1(() => {})
      let t = now
      const lines: string[] = []
      for (; t <= now + span; t += 3_600_000) await tick(t, corpus, cfg, l, sink, { dryRun: true, log: (s) => lines.push(`${iso(t).slice(0, 16)} ${s}`) })
      if (flag('verbose')) for (const s of lines) console.log(s)
      console.log(JSON.stringify(status(t, corpus, cfg, l), null, 2))
      return
    }
    case 'probe': {
      // Diagnose a team write from wherever this runs: GET the report, then POST an internal note. Prints status + headers.
      const reportId = arg ?? '4197599'
      const ident = process.env.H1_TEAM_API_IDENTIFIER ?? cfg.program.team.api_identifier
      const auth = 'Basic ' + Buffer.from(`${ident}:${process.env.H1_TEAM_TOKEN ?? ''}`).toString('base64')
      const base = process.env.H1_API_BASE ?? 'https://api.hackerone.com/v1'
      for (const [method, path, body] of [
        ['GET', `/reports/${reportId}`, undefined],
        ['POST', `/reports/${reportId}/activities`, { data: { type: 'activity-comment', attributes: { message: '(sim probe from ' + (process.env.GITHUB_ACTIONS ? 'GitHub Actions' : 'local') + ' — please ignore)', internal: true } } }],
      ] as const) {
        const res = await fetch(base + path, { method, headers: { Authorization: auth, Accept: 'application/json', 'Content-Type': 'application/json', 'User-Agent': 'program-sim' }, body: body ? JSON.stringify(body) : undefined })
        const text = await res.text()
        console.log(method, path, res.status, JSON.stringify(Object.fromEntries([...res.headers].filter(([k]) => /^(server|cf-|x-request|retry|x-rate|www-auth)/i.test(k)))), text.slice(0, 200))
      }
      return
    }
    case 'check': {
      const client = h1()
      console.log(JSON.stringify(await client.check(), null, 2))
      return
    }
    default:
      console.log(readFileHeader())
      process.exit(cmd ? 1 : 0)
  }
}

function readFileHeader() {
  return 'usage: node src/cli.ts <validate|status|tick|backfill|file|step|retry|simulate|check> [--live] [--ledger path] [--now ISO]'
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1) })
