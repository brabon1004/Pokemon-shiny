import type { Row } from '../../../src/shared/contract.ts'
import type { Rates } from '../../../src/shared/rates.ts'
import { parseDex } from '../dex.ts'
import { resolveTier } from '../resolve-tier.ts'
import { isShinyAvailable } from '../shiny-keys.ts'
import type { EggHatch } from '../upstream-schemas.ts'
import { dedupeByKey, type NormalizeResult, type SkippedEntry } from './common.ts'

export function normalizeEggs(
  hatches: readonly EggHatch[],
  rates: Rates,
  releasedKeys: ReadonlySet<string>,
): NormalizeResult {
  const rows: Row[] = []
  const skipped: SkippedEntry[] = []
  for (const hatch of hatches) {
    const dex = parseDex(hatch.image)
    if (dex === null) {
      skipped.push({ tab: 'eggs', name: hatch.name, image: hatch.image })
      continue
    }
    const odds = resolveTier(rates, { dex, encounterType: 'egg', canBeShiny: isShinyAvailable(hatch.canBeShiny, hatch.image, releasedKeys) })
    const pool = hatch.isAdventureSync ? `${hatch.eggType} (Adventure Sync)` : hatch.eggType
    const source = hatch.isAdventureSync ? `${hatch.eggType} egg (Adventure Sync)` : `${hatch.eggType} egg`
    rows.push({ key: `egg:${pool}:${hatch.name}`, dex, name: hatch.name, source, ...odds })
  }
  return { rows: dedupeByKey(rows), skipped }
}
