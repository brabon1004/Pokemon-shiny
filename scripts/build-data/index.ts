// `npm run build:data [-- --refresh-snapshot]`: fetches upstream data, builds public/data/combined.json.
// Any failure exits non-zero before the output file is touched, so the last good deploy stays live.
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import type { z } from 'zod'
import { combinedSchema } from '../../src/shared/contract.ts'
import { ratesSchema } from '../../src/shared/rates.ts'
import { buildCombined } from './build.ts'
import { fetchJson } from './fetch-json.ts'
import { formatError, formatWarning } from './format-warning.ts'
import { speciesNamesSchema } from './names.ts'
import { loadShinyList, parseUpstream, serializeShinyList, SOURCES } from './sources.ts'
import { eggsSchema, eventsSchema, raidsSchema, researchSchema, shinyListSchema } from './upstream-schemas.ts'
import { writeFileAtomic } from './write-file-atomic.ts'

const REFRESH_SNAPSHOT_FLAG = '--refresh-snapshot'
const SKIPPED_EXAMPLES_SHOWN = 5

/** Paths relative to the repository root. */
const PATHS = {
  rates: 'data/rates.json',
  speciesNames: 'data/species-names.json',
  shinyListSnapshot: 'data/shiny-list.snapshot.json',
  output: 'public/data/combined.json',
} as const

const warn = (message: string): void => console.warn(formatWarning(message, process.env))

const repoPath = (relativePath: string): string => fileURLToPath(new URL(`../../${relativePath}`, import.meta.url))

async function readRepoJson<T>(relativePath: string, schema: z.ZodType<T>): Promise<T> {
  try {
    return parseUpstream(schema, JSON.parse(await readFile(repoPath(relativePath), 'utf8')))
  } catch (error) {
    throw new Error(`unable to load ${relativePath}: ${messageOf(error)}`, { cause: error })
  }
}

async function fetchUpstream<T>(url: string, schema: z.ZodType<T>): Promise<T> {
  const body = await fetchJson(url)
  try {
    return parseUpstream(schema, body)
  } catch (error) {
    throw new Error(`unexpected data from ${url}: ${messageOf(error)}`, { cause: error })
  }
}

async function main(args: readonly string[]): Promise<void> {
  const startedMs = Date.now()
  const shouldRefreshSnapshot = args.includes(REFRESH_SNAPSHOT_FLAG)

  const [rates, names] = await Promise.all([
    readRepoJson(PATHS.rates, ratesSchema),
    readRepoJson(PATHS.speciesNames, speciesNamesSchema),
  ])
  const [raids, eggs, research, events, shinyList] = await Promise.all([
    fetchUpstream(SOURCES.raids, raidsSchema),
    fetchUpstream(SOURCES.eggs, eggsSchema),
    fetchUpstream(SOURCES.research, researchSchema),
    fetchUpstream(SOURCES.events, eventsSchema),
    shouldRefreshSnapshot
      ? // Refreshing must use live data; falling back to the old snapshot would rewrite it with itself.
        fetchUpstream(SOURCES.leekDuckShinyList, shinyListSchema).then((entries) => ({ entries, origin: 'live' as const }))
      : loadShinyList({
          fetchLive: () => fetchJson(SOURCES.leekDuckShinyList),
          readSnapshot: async () => JSON.parse(await readFile(repoPath(PATHS.shinyListSnapshot), 'utf8')),
          warn,
        }),
  ])

  const { combined, skipped, warnings } = buildCombined({
    rates,
    names,
    raids,
    eggs,
    research,
    events,
    shinyList: shinyList.entries,
    now: new Date(),
  })
  const validation = combinedSchema.safeParse(combined)
  if (!validation.success) {
    throw new Error(`output does not match src/shared/contract.ts: ${validation.error.issues[0]?.message ?? 'unknown issue'}`)
  }

  if (shouldRefreshSnapshot) {
    await writeFileAtomic(repoPath(PATHS.shinyListSnapshot), serializeShinyList(shinyList.entries))
  }
  await writeFileAtomic(repoPath(PATHS.output), `${JSON.stringify(validation.data)}\n`)

  if (skipped.length > 0) {
    const examples = skipped.slice(0, SKIPPED_EXAMPLES_SHOWN).map((entry) => `${entry.tab}: ${entry.name} (${entry.image})`)
    warn(`skipped ${skipped.length} upstream entries with no usable dex or name, e.g. ${examples.join('; ')}`)
  }
  for (const warning of warnings) warn(warning)
  const counts = (['wild', 'raids', 'eggs', 'research', 'all'] as const).map((tab) => `${tab}=${combined[tab].length}`)
  console.log(
    `wrote ${PATHS.output}: ${counts.join(' ')} shinyList=${shinyList.origin}` +
      `${shouldRefreshSnapshot ? ' (snapshot refreshed)' : ''} warnings=${skipped.length + warnings.length} in ${Date.now() - startedMs}ms`,
  )
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

main(process.argv.slice(2)).catch((error: unknown) => {
  console.error(formatError(`build:data failed: ${messageOf(error)}`, process.env))
  process.exitCode = 1
})
