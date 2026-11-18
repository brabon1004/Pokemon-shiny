import { describe, expect, it } from 'vitest'
import seedRates from '../../../data/rates.json' with { type: 'json' }
import { ratesSchema } from '../../../src/shared/rates.ts'
import researchFixture from '../__fixtures__/research.json' with { type: 'json' }
import { researchSchema } from '../upstream-schemas.ts'
import { normalizeResearch } from './research.ts'

const RATES = ratesSchema.parse(seedRates)
const TASKS = researchSchema.parse(researchFixture)

function reward(name: string, dex: number, canBeShiny = true) {
  return { name, canBeShiny, image: `https://x/pm${dex}.icon.png` }
}

describe('normalizeResearch', () => {
  it('builds a row per reward with the task text, stripped of HTML, as the source', () => {
    const { rows } = normalizeResearch(TASKS, RATES)
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
    expect(normalizeResearch([task], RATES).rows[0]?.source).toBe(`Catch a Dragon-type & win "x" 'y' ♥ <3`)
  })

  it('keeps words in adjacent elements apart', () => {
    const task = { text: '<span>a</span><span>b</span>', rewards: [reward('Mew', 151)] }
    expect(normalizeResearch([task], RATES).rows[0]?.source).toBe('a b')
  })

  it('never lets a tag through, including one built from encoded brackets', () => {
    const task = { text: '<span>Win</span><script>alert(1)</script> &lt;img src=x onerror=1&gt;', rewards: [reward('Mew', 151)] }
    const source = normalizeResearch([task], RATES).rows[0]?.source
    expect(source).toBe('Win alert(1)')
  })

  it('labels a task whose text is empty after stripping as "Field research"', () => {
    const task = { text: '<span> </span>', rewards: [reward('Mew', 151)] }
    expect(normalizeResearch([task], RATES).rows[0]?.source).toBe('Field research')
  })

  it('gives the same reward from two different tasks distinct keys', () => {
    const tasks = [
      { text: 'Catch 5 Pokémon', rewards: [reward('Pidgey', 16)] },
      { text: 'Spin 5 PokéStops', rewards: [reward('Pidgey', 16)] },
    ]
    const keys = normalizeResearch(tasks, RATES).rows.map((row) => row.key)
    expect(new Set(keys).size).toBe(2)
  })
})
