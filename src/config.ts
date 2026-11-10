import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from 'yaml'

export interface ProgramConfig {
  program: { handle: string; name: string; base_url: string; source_url: string }
  assets: Record<string, string>
  team: { api_identifier: string }
}
export interface Persona { h1_username: string; email: string }
export interface Personas { hackers: Record<string, Persona>; team: Record<string, Persona> }
export interface Cadence {
  arrivals: { enabled: boolean; per_week: number; jitter: number; max_per_tick: number }
  steps: { enabled: boolean; speed: number; max_per_tick: number }
  backfill: { count: number; speed: number; gap: string }
}
export interface Config { root: string; program: ProgramConfig; personas: Personas; cadence: Cadence }

const load = <T>(root: string, f: string): T => parse(readFileSync(join(root, 'config', f), 'utf8')) as T

export function loadConfig(root: string): Config {
  return {
    root,
    program: load<ProgramConfig>(root, 'program.yml'),
    personas: load<Personas>(root, 'personas.yml'),
    cadence: load<Cadence>(root, 'cadence.yml'),
  }
}
