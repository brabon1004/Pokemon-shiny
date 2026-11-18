// `npm run refresh:names`: re-vendors English species names from PokéAPI into data/species-names.json.
// Run by hand when a new generation adds species; PokéAPI asks clients to cache rather than fetch per build.
import { fileURLToPath } from 'node:url'
import { fetchText } from './build-data/fetch-json.ts'
import { parseSpeciesNamesCsv, serializeSpeciesNames } from './build-data/names.ts'
import { SOURCES } from './build-data/sources.ts'
import { writeFileAtomic } from './build-data/write-file-atomic.ts'

const OUTPUT_PATH = 'data/species-names.json'
/** The National Dex had 1025 species in 2026; far fewer means the CSV is truncated or changed. */
const MINIMUM_SPECIES = 1000

async function main(): Promise<void> {
  const names = parseSpeciesNamesCsv(await fetchText(SOURCES.pokeApiSpeciesNames))
  const count = Object.keys(names).length
  if (count < MINIMUM_SPECIES || names['1'] !== 'Bulbasaur') {
    throw new Error(
      `${SOURCES.pokeApiSpeciesNames} gave ${count} English names (dex 1 = "${names['1']}"); ` +
        `expected at least ${MINIMUM_SPECIES} starting with Bulbasaur. ${OUTPUT_PATH} was not changed.`,
    )
  }
  await writeFileAtomic(fileURLToPath(new URL(`../${OUTPUT_PATH}`, import.meta.url)), serializeSpeciesNames(names))
  console.log(`wrote ${OUTPUT_PATH}: ${count} species`)
}

main().catch((error: unknown) => {
  console.error(`refresh:names failed: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})
