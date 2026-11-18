import type { ShinyListEntry } from './upstream-schemas.ts'

/** "pm1.icon.png" → "pm1", "pm88.fALOLA.s.icon.png" → "pm88.fALOLA" (".s" marks the shiny sprite). */
const PM_ICON = /^(pm\d+(?:\.[A-Za-z0-9_]+)*?)(?:\.s)?\.icon\.png$/
/** "pokemon_icon_001_00.png", "poke_capture_0824_000_mf_...": dex, then a numeric form code where all zeros is base. */
const NUMERIC_ICONS = [/^pokemon_icon_(\d+)_(\d+)/, /^poke_capture_(\d+)_(\d+)_/]

/**
 * The LeekDuck shiny-list key (`aa_fn`) for an image URL, or null when the filename does not say which form it is.
 * The numeric schemes only map their base form; other form codes have no known `aa_fn` equivalent.
 */
export function formKeyFromImage(imageUrl: string): string | null {
  const filename = imageUrl.split('/').at(-1) ?? ''
  const pmKey = PM_ICON.exec(filename)?.[1]
  if (pmKey !== undefined) return pmKey
  for (const pattern of NUMERIC_ICONS) {
    const match = pattern.exec(filename)
    if (match === null) continue
    const dex = Number(match[1])
    return dex > 0 && Number(match[2]) === 0 ? `pm${dex}` : null
  }
  return null
}

/** True when a LeekDuck shiny-list entry was released on or before `now`'s UTC date. */
export function isReleased(entry: ShinyListEntry, now: Date): boolean {
  // LeekDuck dates are "YYYY/MM/DD", so a string comparison against today's UTC date orders correctly.
  return entry.released_date <= now.toISOString().slice(0, 10).replaceAll('-', '/')
}

/** `aa_fn` keys of every shiny released by `now`, e.g. "pm1", "pm52.fALOLA", "pm1.cJAN_2020_NOEVOLVE". */
export function releasedShinyKeys(entries: readonly ShinyListEntry[], now: Date): Set<string> {
  return new Set(entries.filter((entry) => isReleased(entry, now)).map((entry) => entry.aa_fn))
}

/**
 * ScrapedDuck's `canBeShiny` misses released shinies (on 2026-11-18 it marked all 198 research rewards false), so
 * an encounter also counts as shiny when its form is on LeekDuck's released shiny list.
 */
export function isShinyAvailable(upstreamCanBeShiny: boolean, imageUrl: string, releasedKeys: ReadonlySet<string>): boolean {
  if (upstreamCanBeShiny) return true
  const formKey = formKeyFromImage(imageUrl)
  return formKey !== null && releasedKeys.has(formKey)
}

/** Below this many entries, "none flagged shiny" can be a real lineup rather than a broken upstream flag. */
const MIN_ENTRIES_TO_JUDGE_FLAGS = 10

/** A build warning when a sizable source flags nothing shiny, which means its upstream flag can't be trusted. */
export function unflaggedShinyWarning(source: string, noun: string, upstreamFlags: readonly boolean[]): string | null {
  if (upstreamFlags.length < MIN_ENTRIES_TO_JUDGE_FLAGS || upstreamFlags.includes(true)) return null
  return `${source}: 0 of ${upstreamFlags.length} ${noun} flagged shiny upstream; using the LeekDuck shiny list instead`
}
