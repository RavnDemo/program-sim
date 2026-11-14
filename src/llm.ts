/** One structured call to Claude through the Messages API, forced through a tool so the answer is JSON. */
const API = 'https://api.anthropic.com/v1/messages'
export const MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-5-5'

export async function decide<T>(system: string, user: string, tool: { name: string; description: string; input_schema: object }): Promise<T> {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) throw new Error('ANTHROPIC_API_KEY is not set')
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        system,
        tools: [tool],
        tool_choice: { type: 'tool', name: tool.name },
        messages: [{ role: 'user', content: user }],
      }),
    })
    if ((res.status === 429 || res.status >= 500) && attempt < 3) {
      await new Promise((r) => setTimeout(r, 3000 * 2 ** attempt))
      continue
    }
    const j: any = await res.json()
    if (!res.ok) throw new Error(`anthropic ${res.status}: ${JSON.stringify(j).slice(0, 300)}`)
    const use = j.content?.find((c: any) => c.type === 'tool_use')
    if (!use) throw new Error('anthropic: no tool_use in response')
    return use.input as T
  }
}
