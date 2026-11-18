// Schema for data/rates.json, the hand-edited shiny rate table read by the data build.
// Erasable-syntax only so Node can import it directly (see contract.ts).
import { z } from 'zod'
import { tierInfoSchema, tierSchema } from './contract.ts'

/**
 * Encounter-type keys are "wild", "research", "egg", or "raid:<ScrapedDuck tier>".
 * The four named keys are required fallbacks; any other key (e.g. "raid:5-Star Raids") may be added.
 */
const encounterDefaultsSchema = z
  .object({
    wild: tierSchema,
    research: tierSchema,
    egg: tierSchema,
    'raid:default': tierSchema,
  })
  .catchall(tierSchema)

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
})
export type Rates = z.infer<typeof ratesSchema>
