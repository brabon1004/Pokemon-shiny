import { z } from 'zod'

const ENGLISH_LANGUAGE_ID = '9'
const EXPECTED_HEADER = 'pokemon_species_id,local_language_id,name,genus'

/** data/species-names.json: dex number (as a string key) → English species name, e.g. `{ "1": "Bulbasaur" }`. */
export const speciesNamesSchema = z.record(z.string().regex(/^[1-9]\d*$/), z.string().min(1))
export type SpeciesNames = z.infer<typeof speciesNamesSchema>

/** Integer-like keys keep numeric order in JSON.stringify, so output is stable between runs. */
export function serializeSpeciesNames(names: SpeciesNames): string {
  return `${JSON.stringify(names, null, 2)}\n`
}

/** Parses PokéAPI `pokemon_species_names.csv` (columns: pokemon_species_id, local_language_id, name, genus). */
export function parseSpeciesNamesCsv(csv: string): SpeciesNames {
  const [header, ...records] = parseCsv(csv)
  const headerText = header?.join(',')
  if (headerText !== EXPECTED_HEADER) {
    throw new Error(`unexpected CSV header "${headerText}"; expected "${EXPECTED_HEADER}". Has PokéAPI changed the file?`)
  }
  const names: SpeciesNames = {}
  for (const [speciesId, languageId, name] of records) {
    if (languageId === ENGLISH_LANGUAGE_ID && speciesId && name) names[speciesId] = name
  }
  return names
}

/** RFC 4180: comma-separated, `"` quotes fields, `""` is a literal quote, CRLF or LF row ends. */
function parseCsv(csv: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < csv.length; i++) {
    const char = csv[i]
    if (inQuotes) {
      if (char === '"' && csv[i + 1] === '"') {
        field += '"'
        i++
      } else if (char === '"') {
        inQuotes = false
      } else {
        field += char
      }
    } else if (char === '"') {
      inQuotes = true
    } else if (char === ',') {
      row.push(field)
      field = ''
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && csv[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else {
      field += char
    }
  }
  if (field !== '' || row.length > 0) rows.push([...row, field])
  return rows
}
