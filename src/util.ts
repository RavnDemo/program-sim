/** Small deterministic helpers. Nothing in the simulator uses Math.random or wall-clock jitter. */

const UNIT: Record<string, number> = { m: 60_000, h: 3_600_000, d: 86_400_000 }

/** "30m" | "4h" | "2d" → milliseconds. */
export function parseDuration(s: string): number {
  const m = /^(\d+(?:\.\d+)?)([mhd])$/.exec(String(s).trim())
  if (!m) throw new Error(`bad duration ${JSON.stringify(s)} (want <n>m, <n>h or <n>d)`)
  return Number(m[1]) * UNIT[m[2]]
}

export function formatDuration(ms: number): string {
  const sign = ms < 0 ? '-' : ''
  ms = Math.abs(ms)
  if (ms >= UNIT.d) return `${sign}${(ms / UNIT.d).toFixed(1)}d`
  if (ms >= UNIT.h) return `${sign}${(ms / UNIT.h).toFixed(1)}h`
  return `${sign}${Math.round(ms / UNIT.m)}m`
}

/** FNV-1a → [0, 1). Stable per input string, so every run computes the same jitter. */
export function unit(seed: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h / 0x1_0000_0000
}

/** ISO 8601 at UTC, the family convention at every boundary. */
export const iso = (ms: number) => new Date(ms).toISOString()
