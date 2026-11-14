/**
 * One structured judgement from Claude: the official SDK, structured outputs (`output_config.format` from a Zod
 * schema), parsed and validated by the SDK. Forced `tool_choice` isn't available on current models, so no tool here.
 *
 * Refusal fallbacks are on (`fallbacks: "default"`): these are vulnerability reports, and a safety classifier may
 * decline one; the API then re-runs it on a fallback model inside the same call.
 */
import Anthropic from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import { z } from 'zod'

export const MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-opus-5-5'

const client = new Anthropic({ maxRetries: 4 })

export async function decide<S extends z.ZodType>(system: string, user: string, schema: S): Promise<z.infer<S> & { _model: string }> {
  const res = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { format: betaZodOutputFormat(schema) },
    system,
    messages: [{ role: 'user', content: user }],
  })
  if (res.stop_reason === 'refusal') throw new Error(`model refused (${res.stop_details?.category ?? 'no category'})`)
  if (!res.parsed_output) throw new Error(`no parsed output (stop_reason ${res.stop_reason})`)
  return { ...(res.parsed_output as z.infer<S>), _model: res.model }
}
