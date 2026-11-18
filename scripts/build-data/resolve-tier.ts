import type { Tier } from '../../src/shared/contract.ts'
import type { Rates } from '../../src/shared/rates.ts'

export interface TierQuery {
  dex: number
  /** "wild", "research", "egg", "raid:<ScrapedDuck tier>", "max:dynamax", or "max:gigantamax". */
  encounterType: string
  canBeShiny: boolean
  /** The event this row comes from (wild and event Max Battle rows). */
  event?: { eventID: string; eventType: string }
  /** Other events running now whose eventOverrides may apply (raid and hand-kept Max Battle rows); first listed wins. */
  activeEventIDs?: readonly string[]
}

export type ShinyOdds =
  | { shiny: true; tier: Tier; denom: number }
  | { shiny: false; tier: null; denom: null }

/**
 * First match wins: eventOverrides (source event, then active events) → speciesOverrides[dex][encounterType]
 * → eventTypeDefaults (source event only) → encounterDefaults[encounterType] → "raid:default" for raids.
 */
export function resolveTier(rates: Rates, query: TierQuery): ShinyOdds {
  if (!query.canBeShiny) return { shiny: false, tier: null, denom: null }
  const tier =
    eventOverride(rates, query) ??
    ownValue(ownValue(rates.speciesOverrides, String(query.dex)) ?? {}, query.encounterType) ??
    (query.event && ownValue(rates.eventTypeDefaults, query.event.eventType)) ??
    encounterDefault(rates, query.encounterType)
  return { shiny: true, tier, denom: rates.tiers[tier].denom }
}

function eventOverride(rates: Rates, query: TierQuery): Tier | undefined {
  const eventIDs = [...(query.event ? [query.event.eventID] : []), ...(query.activeEventIDs ?? [])]
  for (const eventID of eventIDs) {
    const override = ownValue(rates.eventOverrides, eventID)
    if (override?.dex.includes(query.dex)) return override.tier
  }
  return undefined
}

function encounterDefault(rates: Rates, encounterType: string): Tier {
  const tier = ownValue(rates.encounterDefaults, encounterType)
  if (tier !== undefined) return tier
  if (encounterType.startsWith('raid:')) return rates.encounterDefaults['raid:default']
  throw new Error(
    `data/rates.json has no encounterDefaults entry for "${encounterType}". This is a build script bug: ` +
      'normalizers must only use "wild", "research", "egg", "raid:<tier>", "max:dynamax", or "max:gigantamax".',
  )
}

/**
 * `record[key]` for upstream-controlled keys (eventID, eventType, ...): an inherited key such as "constructor" or
 * "__proto__" would otherwise return an Object.prototype member instead of undefined.
 */
export function ownValue<T>(record: Readonly<Record<string, T>>, key: string): T | undefined {
  return Object.hasOwn(record, key) ? record[key] : undefined
}
