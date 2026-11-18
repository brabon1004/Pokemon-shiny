import type { z } from 'zod'
import { shinyListSchema, type ShinyListEntry } from './upstream-schemas.ts'

const SCRAPED_DUCK_BASE = 'https://raw.githubusercontent.com/bigfoott/ScrapedDuck/data'

/** Every upstream URL the data scripts read. ScrapedDuck asks clients not to poll faster than every 5 minutes. */
export const SOURCES = {
  raids: `${SCRAPED_DUCK_BASE}/raids.min.json`,
  eggs: `${SCRAPED_DUCK_BASE}/eggs.min.json`,
  research: `${SCRAPED_DUCK_BASE}/research.min.json`,
  events: `${SCRAPED_DUCK_BASE}/events.min.json`,
  leekDuckShinyList: 'https://leekduck.com/shiny/pms.json',
  pokeApiSpeciesNames:
    'https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/pokemon_species_names.csv',
} as const

/** Validates upstream JSON, naming the first few bad paths, e.g. "invalid shape at [0].dex: expected number". */
export function parseUpstream<T>(schema: z.ZodType<T>, data: unknown): T {
  const parsed = schema.safeParse(data)
  if (parsed.success) return parsed.data
  const details = parsed.error.issues
    .slice(0, 3)
    .map((issue) => `${formatPath(issue.path)}: ${issue.message}`)
    .join('; ')
  throw new Error(`invalid shape at ${details}`)
}

function formatPath(path: readonly PropertyKey[]): string {
  return path.map((part) => (typeof part === 'number' ? `[${part}]` : `.${String(part)}`)).join('').replace(/^\./, '') || '(root)'
}

/** One entry per line so snapshot refreshes produce readable diffs. */
export function serializeShinyList(entries: readonly ShinyListEntry[]): string {
  return `[\n${entries.map((entry) => JSON.stringify(entry)).join(',\n')}\n]\n`
}

export interface ShinyListDeps {
  fetchLive: () => Promise<unknown>
  readSnapshot: () => Promise<unknown>
  warn: (message: string) => void
}

export interface LoadedShinyList {
  entries: ShinyListEntry[]
  origin: 'live' | 'snapshot'
}

/**
 * LeekDuck's list is undocumented and may change without notice, so a failed fetch or unexpected shape falls back
 * to the committed snapshot instead of failing the deploy. A broken snapshot still fails the build.
 */
export async function loadShinyList(deps: ShinyListDeps): Promise<LoadedShinyList> {
  try {
    return { entries: parseUpstream(shinyListSchema, await deps.fetchLive()), origin: 'live' }
  } catch (error) {
    deps.warn(
      `LeekDuck shiny list unavailable, using data/shiny-list.snapshot.json: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
  return { entries: parseUpstream(shinyListSchema, await deps.readSnapshot()), origin: 'snapshot' }
}
