import type { Config } from './config.ts'
import type { Ledger } from './ledger.ts'

/** Fill {{base_url}}, {{source_url}}, {{program}} and {{report:BRM-013}} (→ "#<HackerOne report id>"). */
export function render(text: string | undefined, cfg: Config, ledger: Ledger): string {
  if (!text) return ''
  return text
    .replaceAll('{{base_url}}', cfg.program.program.base_url)
    .replaceAll('{{source_url}}', cfg.program.program.source_url)
    .replaceAll('{{program}}', cfg.program.program.handle)
    .replace(/\{\{report:([A-Z]+-\d+)\}\}/g, (_, id: string) => {
      const r = ledger.scenarios[id]?.report_id
      if (!r) throw new Error(`{{report:${id}}} used before ${id} was filed`)
      return `#${r}`
    })
}
