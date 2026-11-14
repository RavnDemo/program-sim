/**
 * Ravn, as the `bramble-agent` service account (ISA). Three calls only:
 *   - token: redeem the one-time unwrap token, then renew (svc-iam GraphQL on the public gateway)
 *   - mcp:   Ravn's stateless MCP server (JSON-RPC over POST), for list_dispatches and get_case
 *   - answer: the hook answer route
 *
 * ❗The refresh token rotates on EVERY renew and a spent one presented again revokes the whole chain. So it lives in
 * exactly one place — `isa.enc` on the ledger branch, AES-256-GCM under RAVN_ISA_KEY — and only the `sim` workflow
 * (one run at a time, concurrency group `sim`) ever renews it. Never run the agent locally against the live chain.
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

const BASE = process.env.RAVN_URL ?? 'https://apps.ravnsecurity.io'
const UA = 'program-sim/1.0 (+https://github.com/RavnDemo/program-sim)'

interface IsaState { refreshToken: string; refreshExpiresAt?: string }

export class RavnIsa {
  private access?: { token: string; until: number }
  private file: string
  private key: Buffer
  private id = 0

  constructor(stateFile: string, keyB64 = process.env.RAVN_ISA_KEY ?? '') {
    this.file = stateFile
    this.key = Buffer.from(keyB64, 'base64')
    if (this.key.length !== 32) throw new Error('RAVN_ISA_KEY must be 32 bytes, base64')
  }

  private load(): IsaState | undefined {
    if (!existsSync(this.file)) return undefined
    const { iv, tag, data } = JSON.parse(readFileSync(this.file, 'utf8'))
    const d = createDecipheriv('aes-256-gcm', this.key, Buffer.from(iv, 'base64'))
    d.setAuthTag(Buffer.from(tag, 'base64'))
    return JSON.parse(Buffer.concat([d.update(Buffer.from(data, 'base64')), d.final()]).toString('utf8'))
  }

  private save(s: IsaState) {
    const iv = randomBytes(12)
    const c = createCipheriv('aes-256-gcm', this.key, iv)
    const data = Buffer.concat([c.update(JSON.stringify(s), 'utf8'), c.final()])
    writeFileSync(this.file, JSON.stringify({ iv: iv.toString('base64'), tag: c.getAuthTag().toString('base64'), data: data.toString('base64') }) + '\n')
  }

  private async iam(mutation: 'redeemUnwrap' | 'renew', arg: string): Promise<{ accessToken: string; expiresIn: number; refreshToken: string; refreshExpiresAt?: string }> {
    const param = mutation === 'redeemUnwrap' ? 'token' : 'refreshToken'
    const res = await fetch(`${BASE}/api/gateway/graphql`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'user-agent': UA },
      body: JSON.stringify({
        query: `mutation($t:String!){iam{${mutation}(${param}:$t){success code accessToken expiresIn refreshToken refreshExpiresAt}}}`,
        variables: { t: arg },
      }),
    })
    const j: any = await res.json().catch(() => ({}))
    const r = j?.data?.iam?.[mutation]
    if (!r?.success) throw new Error(`ravn ${mutation} refused: ${r?.code ?? res.status} ${JSON.stringify(j?.errors ?? '').slice(0, 200)}`)
    return r
  }

  /** A live access token, renewing (and saving the rotated refresh token first) when needed. */
  async token(): Promise<string> {
    if (this.access && this.access.until > Date.now() + 60_000) return this.access.token
    const state = this.load()
    const unwrap = process.env.RAVN_UNWRAP_TOKEN
    let r
    if (!state && unwrap) r = await this.iam('redeemUnwrap', unwrap)
    else if (state) r = await this.iam('renew', state.refreshToken)
    else throw new Error(`no service-account state at ${this.file} and no RAVN_UNWRAP_TOKEN`)
    this.save({ refreshToken: r.refreshToken, refreshExpiresAt: r.refreshExpiresAt }) // before anything else
    this.access = { token: r.accessToken, until: Date.now() + r.expiresIn * 1000 }
    return r.accessToken
  }

  async mcp<T = any>(tool: string, args: Record<string, unknown>): Promise<T> {
    const res = await fetch(`${BASE}/api/connect/mcp/v1`, {
      method: 'POST',
      headers: { authorization: `Bearer ${await this.token()}`, 'content-type': 'application/json', accept: 'application/json', 'user-agent': UA },
      body: JSON.stringify({ jsonrpc: '2.0', id: ++this.id, method: 'tools/call', params: { name: tool, arguments: args } }),
    })
    const j: any = await res.json().catch(() => ({}))
    if (j.error) throw new Error(`mcp ${tool}: ${res.status} ${j.error.message ?? ''} ${JSON.stringify(j.error.data ?? '')}`.slice(0, 300))
    const result = j.result ?? {}
    if (result.isError) throw new Error(`mcp ${tool} isError: ${JSON.stringify(result.content ?? '').slice(0, 300)}`)
    if (result.structuredContent) return result.structuredContent as T
    const text = result.content?.find((c: any) => c.type === 'text')?.text
    return (text ? JSON.parse(text) : result) as T
  }

  async answer(stageRunId: string, attempt: number, out: unknown): Promise<{ status: number; code: string; paths?: string[] }> {
    const res = await fetch(`${BASE}/api/connect/hooks/v1/answers`, {
      method: 'POST',
      headers: { authorization: `Bearer ${await this.token()}`, 'content-type': 'application/json', 'user-agent': UA },
      body: JSON.stringify({ stageRunId, attempt, out }),
    })
    const j: any = await res.json().catch(() => ({}))
    return { status: res.status, code: j.answer ?? j.code ?? String(res.status), paths: j.paths }
  }
}
