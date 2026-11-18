// Schema for data/rates.json, the hand-edited shiny rate table read by the data build.
// Erasable-syntax only so Node can import it directly (see contract.ts).
import { z } from 'zod'
import { tierInfoSchema, tierSchema } from './contract.ts'

/**
 * Encounter-type keys are "wild", "research", "egg", "raid:<ScrapedDuck tier>", "max:dynamax", or "max:gigantamax".
 * The named keys are required fallbacks; any other key (e.g. "raid:5-Star Raids") may be added.
 */
const encounterDefaultsSchema = z
  .object({
    wild: tierSchema,
    research: tierSchema,
    egg: tierSchema,
    'raid:default': tierSchema,
    'max:dynamax': tierSchema,
    'max:gigantamax': tierSchema,
  })
  .catchall(tierSchema)

export const MAX_FORMS = ['dynamax', 'gigantamax'] as const
export type MaxForm = (typeof MAX_FORMS)[number]

/**
 * The Max Battle rotation, kept by hand because no feed lists it. `until` is the last day the list is known to be
 * right (inclusive); after it the build drops these bosses and warns. `null` means no known end.
 * `{ "updated": "2026-11-18", "until": "2026-11-23", "bosses": [{ "name": "Bulbasaur", "dex": 1, "stars": 1, "form": "dynamax" }] }`
 */
const maxBattlesSchema = z.object({
  updated: z.iso.date(),
  until: z.iso.date().nullable(),
  bosses: z.array(
    z.object({
      /** English species name, matching data/species-names.json for `dex`. */
      name: z.string().min(1),
      dex: z.number().int().positive(),
      stars: z.number().int().min(1).max(6),
      form: z.enum(MAX_FORMS),
    }),
  ),
})
export type MaxBattleBoss = z.infer<typeof maxBattlesSchema>['bosses'][number]

const dexKeySchema = z.string().regex(/^[1-9]\d*$/, 'species override keys must be dex numbers, e.g. "382"')

export const ratesSchema = z.object({
  /** "YYYY-MM-DD" the rates were last reviewed; copied to combined.json as `ratesUpdated`. */
  updated: z.iso.date(),
  tiers: z.record(tierSchema, tierInfoSchema),
  encounterDefaults: encounterDefaultsSchema,
  /** Keyed by ScrapedDuck `eventType`, e.g. "community-day". */
  eventTypeDefaults: z.record(z.string(), tierSchema),
  /** `{ "382": { "raid:5-Star Raids": "raid_day" } }`: dex → encounter type → tier. */
  speciesOverrides: z.record(dexKeySchema, z.record(z.string(), tierSchema)),
  /** `{ "<ScrapedDuck eventID>": { "tier": "event", "dex": [607, 608] } }`. */
  eventOverrides: z.record(
    z.string(),
    z.object({ tier: tierSchema, dex: z.array(z.number().int().positive()).min(1) }),
  ),
  maxBattles: maxBattlesSchema,
})
export type Rates = z.infer<typeof ratesSchema>
