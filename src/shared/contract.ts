// Shape of public/data/combined.json, shared by the data build (Node) and the UI.
// Node imports this file through native type stripping, so keep it erasable-syntax only
// (no enums, namespaces, or parameter properties) and use `.ts` extensions on relative imports.
import { z } from 'zod'

export const TIERS = ['base', 'boosted', 'event', 'legendary', 'comm_day', 'raid_day', 'dynamax', 'gigantamax'] as const
export const tierSchema = z.enum(TIERS)
export type Tier = z.infer<typeof tierSchema>

/** `{ "label": "Boosted", "denom": 64 }` means 1 in 64. `unverified: true` marks an unverified estimate with no research behind it. */
export const tierInfoSchema = z.object({
  label: z.string().min(1),
  denom: z.number().positive(),
  unverified: z.boolean().optional(),
})
export type TierInfo = z.infer<typeof tierInfoSchema>

/**
 * Tiers added with the Dynamax tab, at their data/rates.json values. Only a combined.json written before then lacks
 * them; a cached copy of one can still meet the new UI, which reads every tier.
 */
const TIERS_ADDED_WITH_DYNAMAX = {
  dynamax: { label: 'Dynamax', denom: 64, unverified: true },
  gigantamax: { label: 'Gigantamax', denom: 64, unverified: true },
} as const satisfies Partial<Record<Tier, TierInfo>>

const tiersSchema = z.preprocess(
  (tiers) => (typeof tiers === 'object' && tiers !== null ? { ...TIERS_ADDED_WITH_DYNAMAX, ...tiers } : tiers),
  z.record(tierSchema, tierInfoSchema),
)

/**
 * `start`/`end` come from ScrapedDuck. `local: false` means UTC ISO strings ending in `Z`;
 * `local: true` means wall-clock times with no offset, read in the viewer's timezone.
 */
export const windowSchema = z.object({
  start: z.string().min(1),
  end: z.string().min(1),
  local: z.boolean(),
})

export const rowSchema = z
  .object({
    /** Stable unique id, e.g. "raid:5-Star Raids:Kyogre". */
    key: z.string().min(1),
    dex: z.number().int().positive(),
    /** Display name including form, e.g. "Alolan Meowth". */
    name: z.string().min(1),
    /** Where it is encountered, e.g. "5-star raid", "10 km egg", "Community Day: <event>". */
    source: z.string().min(1),
    shiny: z.boolean(),
    /** 1-in-N odds; null when `shiny` is false. */
    denom: z.number().positive().nullable(),
    tier: tierSchema.nullable(),
    /** Wild and event-detected Max Battle rows only. */
    window: windowSchema.optional(),
  })
  .superRefine((row, ctx) => {
    if (row.shiny && (row.denom === null || row.tier === null)) {
      ctx.addIssue({ code: 'custom', message: `shiny rows need a denom and tier (row ${row.key})` })
    }
    if (!row.shiny && (row.denom !== null || row.tier !== null)) {
      ctx.addIssue({
        code: 'custom',
        message: `non-shiny rows must have denom and tier set to null (row ${row.key})`,
      })
    }
  })
export type Row = z.infer<typeof rowSchema>

/** Key prefix of Dynamax-tab rows from the hand-kept list in data/rates.json; event bosses use "dynamax:<eventID>:". */
export const MAX_BATTLE_LIST_KEY_PREFIX = 'dynamax:list:'

export const combinedSchema = z.object({
  schemaVersion: z.literal(1),
  /** ISO 8601 UTC, e.g. "2026-11-18T14:00:00Z". */
  generatedAt: z.iso.datetime(),
  /** `updated` from data/rates.json, "YYYY-MM-DD". */
  ratesUpdated: z.iso.date(),
  /** Every tier; a file from before the Dynamax tab gets TIERS_ADDED_WITH_DYNAMAX. */
  tiers: tiersSchema,
  wild: z.array(rowSchema),
  raids: z.array(rowSchema),
  /** Max Battle bosses. Defaults to [] so a file written before this tab existed still parses. */
  dynamax: z.array(rowSchema).default([]),
  eggs: z.array(rowSchema),
  research: z.array(rowSchema),
  all: z.array(rowSchema),
})
export type Combined = z.infer<typeof combinedSchema>
