// Shape of public/data/combined.json, shared by the data build (Node) and the UI.
// Node imports this file through native type stripping, so keep it erasable-syntax only
// (no enums, namespaces, or parameter properties) and use `.ts` extensions on relative imports.
import { z } from 'zod'

export const TIERS = ['base', 'boosted', 'event', 'legendary', 'comm_day', 'raid_day'] as const
export const tierSchema = z.enum(TIERS)
export type Tier = z.infer<typeof tierSchema>

/** `{ "label": "Boosted", "denom": 64 }` means 1 in 64. */
export const tierInfoSchema = z.object({
  label: z.string().min(1),
  denom: z.number().positive(),
})
export type TierInfo = z.infer<typeof tierInfoSchema>

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
    /** Wild rows only. */
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

export const combinedSchema = z.object({
  schemaVersion: z.literal(1),
  /** ISO 8601 UTC, e.g. "2026-11-18T14:00:00Z". */
  generatedAt: z.iso.datetime(),
  /** `updated` from data/rates.json, "YYYY-MM-DD". */
  ratesUpdated: z.iso.date(),
  tiers: z.record(tierSchema, tierInfoSchema),
  wild: z.array(rowSchema),
  raids: z.array(rowSchema),
  eggs: z.array(rowSchema),
  research: z.array(rowSchema),
  all: z.array(rowSchema),
})
export type Combined = z.infer<typeof combinedSchema>
