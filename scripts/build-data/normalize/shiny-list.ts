import type { Row } from '../../../src/shared/contract.ts'
import type { Rates } from '../../../src/shared/rates.ts'
import type { SpeciesNames } from '../names.ts'
import { resolveTier } from '../resolve-tier.ts'
import { isReleased } from '../shiny-keys.ts'
import type { ShinyListEntry } from '../upstream-schemas.ts'
import { dedupeByKey, type NormalizeResult, type SkippedEntry } from './common.ts'

export function normalizeShinyList(
  entries: readonly ShinyListEntry[],
  rates: Rates,
  names: SpeciesNames,
  now: Date,
): NormalizeResult {
  const rows: Row[] = []
  const skipped: SkippedEntry[] = []
  for (const entry of entries) {
    if (!isReleased(entry, now)) continue
    const speciesName = names[String(entry.dex)]
    if (speciesName === undefined) {
      // species-names.json is older than this species; `npm run refresh:names` fixes it.
      skipped.push({ tab: 'all', name: `dex ${entry.dex}`, image: entry.aa_fn })
      continue
    }
    const form = entry.aa_fn.slice(`pm${entry.dex}`.length).replace(/^\./, '') || 'base'
    const odds = resolveTier(rates, { dex: entry.dex, encounterType: 'wild', canBeShiny: true })
    const name = formDisplayName(speciesName, entry)
    rows.push({ key: `all:${entry.dex}:${form}`, dex: entry.dex, name, source: `Released ${entry.released_date}`, ...odds })
  }
  return { rows: dedupeByKey(rows), skipped }
}

/**
 * Keyed by the first word of the `.f` form token in `aa_fn` ("pm6.fMEGA_X" → "MEGA"). The token is used instead
 * of `name_suffix` codes because those are ambiguous: "(P)" is Primal Groudon and also Unown P.
 */
const FORM_PREFIXES: Record<string, string> = {
  ALOLA: 'Alolan',
  GALARIAN: 'Galarian',
  HISUIAN: 'Hisuian',
  PALDEA: 'Paldean',
  MEGA: 'Mega',
  PRIMAL: 'Primal',
  GIGANTAMAX: 'Gigantamax',
}
/** Pumpkaboo and Gourgeist sizes; a costume suffix alone ("Halloween") would give all four sizes the same name. */
const SIZE_FORMS = new Set(['SMALL', 'AVERAGE', 'LARGE', 'SUPER'])
/** Mega Charizard X and Y keep their letter after the species name. */
const MEGA_VARIANT_LETTER = /^MEGA_([XY])$/

/** "Alolan Meowth", "Mega Charizard X", "Bulbasaur Party Hat", "Unown (P)", "Kyurem (White)". */
function formDisplayName(speciesName: string, entry: ShinyListEntry): string {
  const formToken = /\.f([A-Z0-9_]+)/.exec(entry.aa_fn)?.[1]
  const prefix = formToken === undefined ? undefined : FORM_PREFIXES[formToken.split('_')[0] ?? '']
  let suffix = (entry.name_suffix ?? '').replace(/\s+/g, ' ').trim()

  if (prefix === undefined) {
    // Forms such as Kyurem's have a token but no suffix; show the token so the rows are distinguishable.
    if (formToken !== undefined && (suffix === '' || SIZE_FORMS.has(formToken))) {
      suffix = `(${titleCase(formToken)}) ${suffix}`.trim()
    }
    return suffix === '' ? speciesName : `${speciesName} ${suffix}`
  }

  // The leading "(A)"/"(M-X)" code repeats what the prefix already says.
  suffix = suffix.replace(/^\([^)]*\)\s*/, '')
  const megaLetter = formToken === undefined ? undefined : MEGA_VARIANT_LETTER.exec(formToken)?.[1]
  return [prefix, speciesName, megaLetter, suffix].filter((part) => part !== undefined && part !== '').join(' ')
}

function titleCase(token: string): string {
  return token
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}
