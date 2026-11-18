import { describe, expect, it } from 'vitest'
import seedRates from '../../../data/rates.json' with { type: 'json' }
import { ratesSchema } from '../../../src/shared/rates.ts'
import researchFixture from '../__fixtures__/research.json' with { type: 'json' }
import { researchSchema } from '../upstream-schemas.ts'
import { normalizeResearch } from './research.ts'

const RATES = ratesSchema.parse(seedRates)
const TASKS = researchSchema.parse(researchFixture)
const NO_RELEASES: ReadonlySet<string> = new Set()

function reward(name: string, dex: number, canBeShiny = true) {
  return { name, canBeShiny, image: `https://x/pm${dex}.icon.png` }
}

describe('normalizeResearch', () => {
  it('rates a reward upstream marks not shiny as shiny at base odds when its form is on the released shiny list', () => {
    const task = { text: 'Catch 8 Pokémon', rewards: [reward('Bulbasaur', 1, false)] }
    expect(normalizeResearch([task], RATES, new Set(['pm1'])).rows[0]).toMatchObject({ shiny: true, tier: 'base', denom: 512 })
  })

  it('keeps a reward not shiny when its form is not on the released list', () => {
    const task = { text: 'Catch 8 Pokémon', rewards: [reward('Bulbasaur', 1, false)] }
    expect(normalizeResearch([task], RATES, new Set(['pm2'])).rows[0]).toMatchObject({ shiny: false, tier: null, denom: null })
  })

  it('matches an Alolan form and the base form against their own shiny-list keys', () => {
    const icon = (file: string) => `https://cdn.leekduck.com/assets/img/pokemon_icons_crop/${file}`
    const task = {
      text: 'Catch 8 Pokémon',
      rewards: [
        { name: 'Meowth', canBeShiny: false, image: icon('pm52.icon.png') },
        { name: 'Alolan Meowth', canBeShiny: false, image: icon('pm52.fALOLA.icon.png') },
      ],
    }
    const shinyByName = (keys: string[]) =>
      normalizeResearch([task], RATES, new Set(keys)).rows.map((row) => [row.name, row.shiny])
    expect(shinyByName(['pm52.fALOLA'])).toEqual([['Meowth', false], ['Alolan Meowth', true]])
    expect(shinyByName(['pm52'])).toEqual([['Meowth', true], ['Alolan Meowth', false]])
  })

  it('builds a row per reward with the task text, stripped of HTML, as the source', () => {
    const { rows } = normalizeResearch(TASKS, RATES, NO_RELEASES)
    expect(rows[0]).toEqual({
      key: expect.stringMatching(/^research:[0-9a-f]{8}:Bulbasaur$/),
      dex: 1,
      name: 'Bulbasaur',
      source: 'Catch 8 Pokémon',
      shiny: false,
      denom: null,
      tier: null,
    })
  })

  it('decodes basic entities and collapses whitespace after removing tags', () => {
    const task = {
      text: '<span>Catch a <b>Dragon-type</b>&nbsp;&amp;\n win &quot;x&quot; &#39;y&#39; &#x2665; &lt;3</span>',
      rewards: [reward('Dratini', 147)],
    }
    expect(normalizeResearch([task], RATES, NO_RELEASES).rows[0]?.source).toBe(`Catch a Dragon-type & win "x" 'y' ♥ <3`)
  })

  it('keeps words in adjacent elements apart', () => {
    const task = { text: '<span>a</span><span>b</span>', rewards: [reward('Mew', 151)] }
    expect(normalizeResearch([task], RATES, NO_RELEASES).rows[0]?.source).toBe('a b')
  })

  it('never lets a tag through, including one built from encoded brackets', () => {
    const task = { text: '<span>Win</span><script>alert(1)</script> &lt;img src=x onerror=1&gt;', rewards: [reward('Mew', 151)] }
    const source = normalizeResearch([task], RATES, NO_RELEASES).rows[0]?.source
    expect(source).toBe('Win alert(1)')
  })

  it('labels a task whose text is empty after stripping as "Field research"', () => {
    const task = { text: '<span> </span>', rewards: [reward('Mew', 151)] }
    expect(normalizeResearch([task], RATES, NO_RELEASES).rows[0]?.source).toBe('Field research')
  })

  it('gives the same reward from two different tasks distinct keys', () => {
    const tasks = [
      { text: 'Catch 5 Pokémon', rewards: [reward('Pidgey', 16)] },
      { text: 'Spin 5 PokéStops', rewards: [reward('Pidgey', 16)] },
    ]
    const keys = normalizeResearch(tasks, RATES, NO_RELEASES).rows.map((row) => row.key)
    expect(new Set(keys).size).toBe(2)
  })
})
