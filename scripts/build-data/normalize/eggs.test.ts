import { describe, expect, it } from 'vitest'
import seedRates from '../../../data/rates.json' with { type: 'json' }
import { ratesSchema } from '../../../src/shared/rates.ts'
import eggsFixture from '../__fixtures__/eggs.json' with { type: 'json' }
import { eggsSchema } from '../upstream-schemas.ts'
import { normalizeEggs } from './eggs.ts'

const RATES = ratesSchema.parse(seedRates)
const EGGS = eggsSchema.parse(eggsFixture)
const NO_RELEASES: ReadonlySet<string> = new Set()

describe('normalizeEggs', () => {
  it('builds a row per hatch with the egg distance as the source', () => {
    const { rows, skipped } = normalizeEggs(EGGS, RATES, NO_RELEASES)
    expect(skipped).toEqual([])
    // 78 entries; Galarian Corsola appears twice in 7 km eggs (once flagged isGiftExchange), so one is deduped.
    expect(rows).toHaveLength(77)
    expect(rows[0]).toEqual({
      key: 'egg:1 km:Bulbasaur',
      dex: 1,
      name: 'Bulbasaur',
      source: '1 km egg',
      shiny: true,
      denom: 64,
      tier: 'boosted',
    })
  })

  it('labels Adventure Sync rewards separately from the regular egg pool', () => {
    const hatch = { name: 'Chingling', eggType: '5 km', canBeShiny: true, isAdventureSync: false, image: 'https://x/pm433.icon.png' }
    const { rows } = normalizeEggs([hatch, { ...hatch, isAdventureSync: true }], RATES, NO_RELEASES)
    expect(rows.map((row) => [row.key, row.source])).toEqual([
      ['egg:5 km:Chingling', '5 km egg'],
      ['egg:5 km (Adventure Sync):Chingling', '5 km egg (Adventure Sync)'],
    ])
  })

  it('marks a hatch that cannot be shiny with no odds', () => {
    const hatch = { name: 'Happiny', eggType: '2 km', canBeShiny: false, isAdventureSync: false, image: 'https://x/pm440.icon.png' }
    expect(normalizeEggs([hatch], RATES, NO_RELEASES).rows[0]).toMatchObject({ shiny: false, tier: null, denom: null })
  })
  it('rates a hatch upstream marks not shiny at the egg rate when its form is on the released shiny list', () => {
    const hatch = { name: 'Happiny', eggType: '2 km', canBeShiny: false, isAdventureSync: false, image: 'https://x/pm440.icon.png' }
    expect(normalizeEggs([hatch], RATES, new Set(['pm440'])).rows[0]).toMatchObject({ shiny: true, tier: 'boosted', denom: 64 })
  })
})
