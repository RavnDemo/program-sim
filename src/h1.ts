import type { Config } from './config.ts'
import type { Rating, State } from './corpus.ts'

export interface NewReport {
  title: string
  vulnerability_information: string
  impact: string
  severity_rating: Rating
  /** CWE id like "cwe-89"; resolved to the program's weakness id. */
  weakness?: string
  /** Structured scope asset_identifier; resolved to its id. */
  asset?: string
}

/** Everything the simulator does to HackerOne. Live and dry-run implement the same surface. */
export interface H1 {
  file(persona: string, r: NewReport): Promise<string>
  reporterComment(persona: string, reportId: string, message: string): Promise<string | undefined>
  teamComment(reportId: string, message: string, internal: boolean): Promise<string | undefined>
  state(reportId: string, state: State, message: string, originalReportId?: string): Promise<string | undefined>
  severity(reportId: string, rating: Rating): Promise<string | undefined>
  bounty(reportId: string, amount: number, message: string): Promise<string | undefined>
  check(): Promise<Record<string, unknown>>
}

/** Prints what it would do and invents report ids. */
export class DryRunH1 implements H1 {
  private n = 9_000_000
  private log: (s: string) => void
  constructor(log: (s: string) => void) { this.log = log }
  async file(persona: string, r: NewReport) {
    const id = String(++this.n)
    this.log(`  [dry] ${persona} files "${r.title}" (${r.severity_rating}, ${r.weakness ?? 'no weakness'}, ${r.asset ?? 'no asset'})`)
    return id
  }
  async reporterComment(persona: string, id: string, m: string) { this.log(`  [dry] ${persona} comments on #${id}: ${m.slice(0, 80)}`); return undefined }
  async teamComment(id: string, m: string, internal: boolean) { this.log(`  [dry] team ${internal ? 'internal note' : 'comments'} on #${id}: ${m.slice(0, 80)}`); return undefined }
  async state(id: string, s: State, _m: string, orig?: string) { this.log(`  [dry] team sets #${id} → ${s}${orig ? ` (of #${orig})` : ''}`); return undefined }
  async severity(id: string, r: Rating) { this.log(`  [dry] team rates #${id} ${r}`); return undefined }
  async bounty(id: string, a: number) { this.log(`  [dry] team awards #${id} $${a}`); return undefined }
  async check() { return { mode: 'dry-run' } }
}

const API = process.env.H1_API_BASE ?? 'https://api.hackerone.com/v1'

/** Talks to api.hackerone.com. Hackers use the Hacker API with their own token; the team uses a Customer API token. */
export class LiveH1 implements H1 {
  private weaknesses?: Map<string, string>
  private scopes?: Map<string, string>
  private programId?: string

  private cfg: Config
  constructor(cfg: Config) { this.cfg = cfg }

  private hackerAuth(persona: string): string {
    const p = this.cfg.personas.hackers[persona]
    if (!p) throw new Error(`unknown persona ${persona}`)
    const token = process.env[`H1_${persona.toUpperCase()}_TOKEN`]
    if (!token) throw new Error(`H1_${persona.toUpperCase()}_TOKEN is not set`)
    const user = process.env[`H1_${persona.toUpperCase()}_USERNAME`] ?? p.h1_username
    return 'Basic ' + Buffer.from(`${user}:${token}`).toString('base64')
  }

  private teamAuth(): string {
    const token = process.env.H1_TEAM_TOKEN
    if (!token) throw new Error('H1_TEAM_TOKEN is not set')
    const ident = process.env.H1_TEAM_API_IDENTIFIER ?? this.cfg.program.team.api_identifier
    return 'Basic ' + Buffer.from(`${ident}:${token}`).toString('base64')
  }

  private async call<T = any>(auth: string, method: string, path: string, body?: unknown): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      const res = await fetch(`${API}${path}`, {
        method,
        headers: { Authorization: auth, Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
        body: body ? JSON.stringify(body) : undefined,
      })
      if (res.status === 429 && attempt < 3) {
        await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt))
        continue
      }
      const text = await res.text()
      if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${text.slice(0, 300)}`)
      return (text ? JSON.parse(text) : {}) as T
    }
  }

  private async paged(auth: string, path: string): Promise<any[]> {
    const out: any[] = []
    let url: string | undefined = `${path}${path.includes('?') ? '&' : '?'}page[size]=100`
    while (url) {
      const r: any = await this.call(auth, 'GET', url)
      out.push(...(r.data ?? []))
      url = r.links?.next ? r.links.next.replace(API, '') : undefined
    }
    return out
  }

  /** Weakness and scope ids, as a hacker sees them (Hacker API; scopes are limited to 50 reads/min, so cached per run). */
  private async resolveProgram(persona: string) {
    if (this.weaknesses && this.scopes) return
    const auth = this.hackerAuth(persona)
    const handle = encodeURIComponent(this.cfg.program.program.handle)
    const ws = await this.paged(auth, `/hackers/programs/${handle}/weaknesses`)
    this.weaknesses = new Map(ws.filter((w) => w.attributes?.external_id).map((w) => [String(w.attributes.external_id).toLowerCase(), String(w.id)]))
    const ss = await this.paged(auth, `/hackers/programs/${handle}/structured_scopes`)
    this.scopes = new Map(ss.map((s) => [String(s.attributes?.asset_identifier), String(s.id)]))
  }

  /** The program's id as the team token sees it. */
  private async teamProgram(): Promise<string> {
    if (this.programId) return this.programId
    const handle = this.cfg.program.program.handle
    const programs = await this.paged(this.teamAuth(), '/me/programs')
    const p = programs.find((x) => x.attributes?.handle === handle)
    if (!p) throw new Error(`program ${handle} not visible to the team token (saw: ${programs.map((x) => x.attributes?.handle).join(', ') || 'none'})`)
    return (this.programId = String(p.id))
  }

  async file(persona: string, r: NewReport): Promise<string> {
    await this.resolveProgram(persona)
    const attributes: Record<string, unknown> = {
      team_handle: this.cfg.program.program.handle,
      title: r.title,
      vulnerability_information: r.vulnerability_information,
      impact: r.impact || 'See the report.',
      severity_rating: r.severity_rating,
    }
    if (r.weakness) {
      const w = this.weaknesses!.get(r.weakness.toLowerCase())
      if (w) attributes.weakness_id = Number(w)
    }
    if (r.asset) {
      const s = this.scopes!.get(r.asset)
      if (s) attributes.structured_scope_id = Number(s)
    }
    const res = await this.call(this.hackerAuth(persona), 'POST', '/hackers/reports', { data: { type: 'report', attributes } })
    return String(res.data?.id)
  }

  async reporterComment(persona: string, reportId: string, message: string) {
    // The Hacker API has no endpoint for a reporter to comment; see docs/operating.md. Recorded as skipped.
    void persona; void reportId; void message
    return 'skipped: Hacker API cannot comment'
  }

  async teamComment(reportId: string, message: string, internal: boolean) {
    const r = await this.call(this.teamAuth(), 'POST', `/reports/${reportId}/activities`, {
      data: { type: 'activity-comment', attributes: { message, internal } },
    })
    return r.data?.id ? `activity ${r.data.id}` : undefined
  }

  async state(reportId: string, state: State, message: string, originalReportId?: string) {
    const attributes: Record<string, unknown> = { state, message: message || undefined }
    if (state === 'duplicate' && originalReportId) attributes.original_report_id = Number(originalReportId)
    await this.call(this.teamAuth(), 'POST', `/reports/${reportId}/state_changes`, { data: { type: 'state-change', attributes } })
    return undefined
  }

  async severity(reportId: string, rating: Rating) {
    await this.call(this.teamAuth(), 'POST', `/reports/${reportId}/severities`, { data: { type: 'severity', attributes: { rating } } })
    return undefined
  }

  async bounty(reportId: string, amount: number, message: string) {
    // No `type`/`attributes` wrapper on this one (per the Customer API docs). Needs Reward Management.
    await this.call(this.teamAuth(), 'POST', `/reports/${reportId}/bounties`, {
      data: { amount, bonus_amount: 0, message: message || 'Bounty awarded.' },
    })
    return undefined
  }

  async check() {
    const out: Record<string, unknown> = {}
    try {
      out.team = { ok: true, program_id: await this.teamProgram() }
    } catch (e) { out.team = { ok: false, error: (e as Error).message } }
    for (const persona of Object.keys(this.cfg.personas.hackers)) {
      try {
        const me = await this.call(this.hackerAuth(persona), 'GET', '/hackers/me/reports?page[size]=1')
        out[persona] = { ok: true, reports_seen: me.data?.length ?? 0 }
        if (!this.scopes) {
          await this.resolveProgram(persona)
          out.program = { weaknesses: this.weaknesses!.size, scopes: [...this.scopes!.keys()] }
          const missing = Object.entries(this.cfg.program.assets).filter(([, a]) => !this.scopes!.has(a)).map(([k]) => k)
          if (missing.length) out.missing_assets = missing
        }
      } catch (e) { out[persona] = { ok: false, error: (e as Error).message } }
    }
    return out
  }
}
