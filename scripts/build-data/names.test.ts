import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseSpeciesNamesCsv } from './names.ts'

const FIXTURE_CSV = readFileSync(new URL('./__fixtures__/species-names.csv', import.meta.url), 'utf8')

describe('parseSpeciesNamesCsv', () => {
  it('keeps only English (language 9) names keyed by dex', () => {
    const names = parseSpeciesNamesCsv(FIXTURE_CSV)
    expect(names['1']).toBe('Bulbasaur')
    expect(names['983']).toBe('Kingambit')
    expect(Object.keys(names)).toHaveLength(18)
  })

  it('handles quoted fields containing commas and doubled quotes', () => {
    const csv = [
      'pokemon_species_id,local_language_id,name,genus',
      '29,9,"Nidoran, ""F""","Poison Pin, Pokémon"',
      '30,9,Nidorina,Poison Pin Pokémon',
    ].join('\r\n')
    expect(parseSpeciesNamesCsv(csv)).toEqual({ '29': 'Nidoran, "F"', '30': 'Nidorina' })
  })

  it('throws when the header does not match the expected PokéAPI columns', () => {
    expect(() => parseSpeciesNamesCsv('id,lang,label\n1,9,Bulbasaur')).toThrow(/unexpected CSV header/)
  })
})
