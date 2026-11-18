// zod schemas for the upstream JSON the build reads. Only the fields the build uses are listed;
// zod drops the rest. Tier, egg, and event type strings are plain strings so a new upstream value
// passes through instead of failing the build.
import { z } from 'zod'

const imageSchema = z.string()

export const raidsSchema = z.array(
  z.object({ name: z.string().min(1), tier: z.string().min(1), canBeShiny: z.boolean(), image: imageSchema }),
)
export type RaidBoss = z.infer<typeof raidsSchema>[number]

export const eggsSchema = z.array(
  z.object({
    name: z.string().min(1),
    eggType: z.string().min(1),
    canBeShiny: z.boolean(),
    image: imageSchema,
    isAdventureSync: z.boolean(),
  }),
)
export type EggHatch = z.infer<typeof eggsSchema>[number]

export const researchSchema = z.array(
  z.object({
    /** HTML, e.g. "<span>Catch 8 Pokémon</span>". */
    text: z.string(),
    rewards: z.array(z.object({ name: z.string().min(1), image: imageSchema, canBeShiny: z.boolean() })),
  }),
)
export type ResearchTask = z.infer<typeof researchSchema>[number]

const namedImageSchema = z.object({ name: z.string().min(1), image: imageSchema })
const spotlightEntrySchema = namedImageSchema.extend({ canBeShiny: z.boolean() })

export const eventsSchema = z.array(
  z.object({
    eventID: z.string().min(1),
    name: z.string().min(1),
    eventType: z.string(),
    /** ISO 8601. Ends in "Z" for UTC; no offset means player-local wall-clock time. */
    start: z.string().nullable(),
    end: z.string().nullable(),
    /** The LeekDuck event page, e.g. "https://leekduck.com/events/dynamax-trails-2026/". */
    link: z.string().nullish(),
    extraData: z
      .object({
        communityday: z
          .object({ spawns: z.array(namedImageSchema).optional(), shinies: z.array(namedImageSchema).optional() })
          .optional(),
        /** The featured species; `list` holds every species when a Spotlight Hour features several. */
        spotlight: spotlightEntrySchema
          .partial()
          .extend({ list: z.array(spotlightEntrySchema).optional() })
          .optional(),
        /** `hasSpawns` means the event page lists wild encounters that this JSON leaves out. */
        generic: z.object({ hasSpawns: z.boolean().optional() }).optional(),
      })
      .nullish(),
  }),
)
export type GameEvent = z.infer<typeof eventsSchema>[number]

/** LeekDuck `shiny/pms.json`: one entry per released shiny form or costume. */
export const shinyListSchema = z.array(
  z.object({
    dex: z.number().int().positive(),
    /** "YYYY/MM/DD"; may be in the future. */
    released_date: z.string().regex(/^\d{4}\/\d{2}\/\d{2}$/),
    /** Asset name, e.g. "pm52.fALOLA". */
    aa_fn: z.string().min(1),
    isotope: z.string().optional(),
    /** Display hint, e.g. "(A)", "Party\nHat". */
    name_suffix: z.string().optional(),
  }),
)
export type ShinyListEntry = z.infer<typeof shinyListSchema>[number]
