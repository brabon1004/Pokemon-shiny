import type { Row } from '../../../src/shared/contract.ts'
import type { Rates } from '../../../src/shared/rates.ts'
import { parseDex } from '../dex.ts'
import { resolveTier } from '../resolve-tier.ts'
import { isShinyAvailable } from '../shiny-keys.ts'
import type { RaidBoss } from '../upstream-schemas.ts'
import { dedupeByKey, type NormalizeResult, type SkippedEntry } from './common.ts'

export interface RaidsResult extends NormalizeResult {
  /** Upstream tier names with no `raid:<tier>` encounterDefaults entry; their bosses are rated as raid:default. */
  unmappedTiers: string[]
}

export function normalizeRaids(
  bosses: readonly RaidBoss[],
  rates: Rates,
  activeEventIDs: readonly string[],
  releasedKeys: ReadonlySet<string>,
): RaidsResult {
  const rows: Row[] = []
  const skipped: SkippedEntry[] = []
  const unmappedTiers = new Set<string>()
  for (const boss of bosses) {
    if (rates.encounterDefaults[`raid:${boss.tier}`] === undefined) unmappedTiers.add(boss.tier)
    const dex = parseDex(boss.image)
    if (dex === null) {
      skipped.push({ tab: 'raids', name: boss.name, image: boss.image })
      continue
    }
    // ponytail: raid rows carry no window, so an active event's override (e.g. Raid Day) applies for the whole build
    // window around the event, up to ~14 h either side for local-time events. Upgrade path: emit a window on boosted
    // raid rows and have the UI fall back to the default tier outside it.
    // A shadow boss shares its image with the normal form, and the shiny list has no shadow entries, so a released
    // normal shiny says nothing about the shadow one.
    const canBeShiny = isShadow(boss) ? boss.canBeShiny : isShinyAvailable(boss.canBeShiny, boss.image, releasedKeys)
    const odds = resolveTier(rates, { dex, encounterType: `raid:${boss.tier}`, canBeShiny, activeEventIDs })
    rows.push({ key: `raid:${boss.tier}:${boss.name}`, dex, name: boss.name, source: raidSource(boss), ...odds })
  }
  return { rows: dedupeByKey(rows), skipped, unmappedTiers: [...unmappedTiers] }
}

/** "1-Star Raids" → "1-star raid", "Mega Raids" → "Mega raid", a "Shadow X" boss → "Shadow 1-star raid". */
function raidSource(boss: RaidBoss): string {
  const tierLabel = boss.tier.replace(/-Star\b/, '-star').replace(/ Raids?$/, ' raid')
  return isShadow(boss) ? `Shadow ${tierLabel}` : tierLabel
}

function isShadow(boss: RaidBoss): boolean {
  return boss.name.startsWith('Shadow ')
}
