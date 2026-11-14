import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Config } from '../src/config.ts'
import type { Corpus, IndexRow, Scenario } from '../src/corpus.ts'
import { validate } from '../src/corpus.ts'
import { emptyLedger } from '../src/ledger.ts'
import { tick, arrivalGap, PARK_AFTER } from '../src/engine.ts'
import type { H1 } from '../src/h1.ts'
import { parseDuration, unit } from '../src/util.ts'

const H = 3_600_000
const cfg: Config = {
  root: '.',
  program: { program: { handle: 'p', name: 'P', base_url: 'https://b.example', source_url: 'https://g/x' }, assets: { web: 'https://b.example' }, team: { api_identifier: 't' } },
  personas: { hackers: { a: { h1_username: 'a', email: 'a@x' } }, team: {} },
  cadence: { arrivals: { enabled: true, per_week: 7, jitter: 0, max_per_tick: 1 }, steps: { enabled: true, speed: 1, max_per_tick: 50 }, backfill: { count: 2, speed: 0.5, gap: '1h' }, bounties: { enabled: true } },
}

function corpus(): Corpus {
  const rows: IndexRow[] = [
    { id: 'T-001', reporter: 'a', asset: 'web', weakness: 'cwe-79', claimed_severity: 'high', outcome: 'resolved', severity: 'high', bounty: 100 },
    { id: 'T-002', reporter: 'a', claimed_severity: 'low', outcome: 'duplicate', severity: 'high', bounty: 0, duplicate_of: 'T-001' },
  ]
  const s = (row: IndexRow, timeline: Scenario['timeline']): Scenario => ({ id: row.id, title: `t ${row.id}`, vulnerability_information: 'see {{base_url}}', timeline, row })
  return {
    rows,
    order: rows.map((r) => r.id),
    scenarios: new Map([
      ['T-001', s(rows[0], [
        { after: '1h', by: 'team', do: 'state', state: 'triaged', message: 'ok' },
        { after: '2h', by: 'team', do: 'state', state: 'resolved', message: 'fixed' },
        { after: '1h', by: 'team', do: 'bounty', amount: 100 },
      ])],
      ['T-002', s(rows[1], [{ after: '1h', by: 'team', do: 'state', state: 'duplicate', message: 'dup of {{report:T-001}}' }])],
    ]),
  }
}

function recorder() {
  const calls: string[] = []
  let n = 100
  const h1: H1 = {
    async file(p, r) { calls.push(`file ${p} ${r.title} ${r.vulnerability_information}`); return String(++n) },
    async reporterComment() { calls.push('rc'); return undefined },
    async teamComment(id, m) { calls.push(`comment ${id} ${m}`); return undefined },
    async state(id, s, m, o) { calls.push(`state ${id} ${s} ${m}${o ? ` orig=${o}` : ''}`); return undefined },
    async severity(id, r) { calls.push(`sev ${id} ${r}`); return undefined },
    async bounty(id, a) { calls.push(`bounty ${id} ${a}`); return undefined },
    async check() { return {} },
  }
  return { h1, calls }
}

test('durations and jitter are deterministic', () => {
  assert.equal(parseDuration('90m'), 90 * 60_000)
  assert.equal(parseDuration('2d'), 48 * H)
  assert.throws(() => parseDuration('2 days'))
  assert.equal(unit('BRM-001'), unit('BRM-001'))
  assert.notEqual(unit('BRM-001'), unit('BRM-002'))
})

test('the test corpus is valid', () => {
  assert.deepEqual(validate(corpus(), cfg.program.assets, ['a']), [])
})

test('validate catches a timeline that ends in the wrong state', () => {
  const c = corpus()
  c.scenarios.get('T-001')!.timeline.splice(1)
  const problems = validate(c, cfg.program.assets, ['a'])
  assert.ok(problems.some((p) => p.includes('ends in triaged')), problems.join('\n'))
})

test('a program runs: arrival, steps in order, duplicate points at its original', async () => {
  const c = corpus()
  const l = emptyLedger('p')
  const { h1, calls } = recorder()
  const t0 = Date.parse('2026-11-10T00:00:00Z')
  for (let t = t0; t <= t0 + 3 * 24 * H; t += H) await tick(t, c, cfg, l, h1, { dryRun: true })
  assert.equal(calls[0], 'file a t T-001 see https://b.example')
  assert.deepEqual(calls.filter((x) => x.startsWith('state 101') || x.startsWith('bounty')), ['state 101 triaged ok', 'state 101 resolved fixed', 'bounty 101 100'])
  assert.ok(calls.includes('state 102 duplicate dup of #101 orig=101'), calls.join('\n'))
  assert.ok(l.scenarios['T-001'].done && l.scenarios['T-002'].done)
  // T-002 arrives one average gap (1d at 7/week, no jitter) after T-001
  assert.equal(Date.parse(l.scenarios['T-002'].filed_at) - Date.parse(l.scenarios['T-001'].filed_at), arrivalGap(cfg, 'T-002'))
})

test('a failing step backs off (one try per tick at most), then parks', async () => {
  const c = corpus()
  const l = emptyLedger('p')
  const { h1 } = recorder()
  let tries = 0
  h1.state = async () => { tries++; throw new Error('boom') }
  const t0 = Date.parse('2026-11-10T00:00:00Z')
  await tick(t0, c, cfg, l, h1, { dryRun: true })
  await tick(t0 + H + 1, c, cfg, l, h1, { dryRun: true })
  assert.equal(tries, 1, 'one try in the first tick that reaches the step; none while backing off')
  for (let t = t0 + 2 * H; t <= t0 + 4 * 24 * H; t += H) await tick(t, c, cfg, l, h1, { dryRun: true })
  assert.equal(l.scenarios['T-001'].failures, PARK_AFTER)
  assert.equal(l.scenarios['T-001'].next_step, 0)
})

test('a step that fails, then succeeds, carries on', async () => {
  const c = corpus()
  const l = emptyLedger('p')
  const { h1, calls } = recorder()
  const ok = h1.state
  let n = 0
  h1.state = async (...a) => { if (n++ < 2) throw new Error('403'); return ok(...a) }
  const t0 = Date.parse('2026-11-10T00:00:00Z')
  for (let t = t0; t <= t0 + 3 * 24 * H; t += H) await tick(t, c, cfg, l, h1, { dryRun: true })
  assert.ok(l.scenarios['T-001'].done, JSON.stringify(l.scenarios['T-001']))
  assert.ok(calls.includes('bounty 101 100'))
})

test('backfill files on the backfill gap and runs timelines faster', async () => {
  const c = corpus()
  const l = emptyLedger('p')
  l.backfill = { remaining: 2 }
  const { h1 } = recorder()
  const t0 = Date.parse('2026-11-10T00:00:00Z')
  for (let t = t0; t <= t0 + 2 * H; t += H) await tick(t, c, cfg, l, h1, { dryRun: true })
  assert.equal(Object.keys(l.scenarios).length, 2)
  assert.equal(l.scenarios['T-001'].speed, 0.5)
  assert.equal(l.backfill, undefined)
})

test('bounties are skipped, not sent, when disabled', async () => {
  const c = corpus()
  const l = emptyLedger('p')
  const { h1, calls } = recorder()
  const off = { ...cfg, cadence: { ...cfg.cadence, bounties: { enabled: false } } }
  const t0 = Date.parse('2026-11-10T00:00:00Z')
  for (let t = t0; t <= t0 + 10 * H; t += H) await tick(t, c, off, l, h1, { dryRun: true })
  assert.ok(!calls.some((x) => x.startsWith('bounty')))
  assert.ok(l.scenarios['T-001'].done)
  assert.ok(l.log.some((x) => x.detail?.startsWith('skipped: bounties disabled')))
})
