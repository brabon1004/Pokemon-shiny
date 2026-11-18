import { describe, expect, it } from 'vitest'
import seedRates from '../../../data/rates.json' with { type: 'json' }
import speciesNames from '../../../data/species-names.json' with { type: 'json' }
import { ratesSchema } from '../../../src/shared/rates.ts'
import shinyListFixture from '../__fixtures__/leekduck-shiny.json' with { type: 'json' }
import { shinyListSchema } from '../upstream-schemas.ts'
import { normalizeShinyList } from './shiny-list.ts'

const RATES = ratesSchema.parse(seedRates)
const SHINY_LIST = shinyListSchema.parse(shinyListFixture)
const BUILD_TIME = new Date('2026-11-18T23:30:00Z')

function entry(aa_fn: string, name_suffix?: string, released_date = '2020/01/01') {
  const dex = Number(/^pm(\d+)/.exec(aa_fn)?.[1])
  return { dex, aa_fn, released_date, ...(name_suffix === undefined ? {} : { name_suffix }) }
}

describe('normalizeShinyList', () => {
  it('builds one base-rate row per entry released on or before the build date (UTC)', () => {
    const { rows } = normalizeShinyList(SHINY_LIST, RATES, speciesNames, BUILD_TIME)
    // The fixture has 44 entries; Mega Clefable (2026/11/28) and a 2027 Pikachu are unreleased.
    expect(rows).toHaveLength(42)
    expect(rows[0]).toEqual({
      key: 'all:1:base',
      dex: 1,
      name: 'Bulbasaur',
      source: 'Released 2018/03/25',
      shiny: true,
      denom: 512,
      tier: 'base',
    })
    expect(rows.some((row) => row.dex === 36)).toBe(false)
  })

  it.each([
    ['pm52.fALOLA', '(A)', 'Alolan Meowth'],
    ['pm52.fGALARIAN', '(G)', 'Galarian Meowth'],
    ['pm58.fHISUIAN', '(H)', 'Hisuian Growlithe'],
    ['pm194.fPALDEA', undefined, 'Paldean Wooper'],
    ['pm128.fPALDEA_AQUA', 'Aqua\nBreed', 'Paldean Tauros Aqua Breed'],
    ['pm3.fMEGA', '(M)', 'Mega Venusaur'],
    ['pm6.fMEGA_X', '(M-X)', 'Mega Charizard X'],
    ['pm3.fGIGANTAMAX', '(GM)', 'Gigantamax Venusaur'],
    ['pm383.fPRIMAL', '(P)', 'Primal Groudon'],
    ['pm77.fGALARIAN.cGOFEST_2021_NOEVOLVE', '(G)\nMeloetta\nHat', 'Galarian Ponyta Meloetta Hat'],
    ['pm201.fUNOWN_P', '(P)', 'Unown (P)'],
    ['pm1.cJAN_2020_NOEVOLVE', 'Party\nHat', 'Bulbasaur Party Hat'],
    ['pm202.g2', '(♀)', 'Wobbuffet (♀)'],
    ['pm646.fWHITE', undefined, 'Kyurem (White)'],
    ['pm710.fSMALL', undefined, 'Pumpkaboo (Small)'],
    ['pm710.fSUPER.cFALL_2022', 'Halloween', 'Pumpkaboo (Super) Halloween'],
  ])('names %s with suffix %j as "%s"', (aa_fn, suffix, expectedName) => {
    const { rows } = normalizeShinyList([entry(aa_fn, suffix)], RATES, speciesNames, BUILD_TIME)
    expect(rows[0]?.name).toBe(expectedName)
  })

  it('gives each size of a costumed Pumpkaboo and Gourgeist its own name', () => {
    const sizes = ['SMALL', 'AVERAGE', 'LARGE', 'SUPER']
    const entries = [710, 711].flatMap((dex) => sizes.map((size) => entry(`pm${dex}.f${size}.cFALL_2022`, 'Halloween')))
    const names = normalizeShinyList(entries, RATES, speciesNames, BUILD_TIME).rows.map((row) => row.name)
    expect(names).toEqual([
      'Pumpkaboo (Small) Halloween',
      'Pumpkaboo (Average) Halloween',
      'Pumpkaboo (Large) Halloween',
      'Pumpkaboo (Super) Halloween',
      'Gourgeist (Small) Halloween',
      'Gourgeist (Average) Halloween',
      'Gourgeist (Large) Halloween',
      'Gourgeist (Super) Halloween',
    ])
  })

  it('includes an entry released on the build date and excludes the next day', () => {
    const entries = [entry('pm1', undefined, '2026/11/18'), entry('pm2', undefined, '2026/11/19')]
    const { rows } = normalizeShinyList(entries, RATES, speciesNames, BUILD_TIME)
    expect(rows.map((row) => row.dex)).toEqual([1])
  })

  it('applies a wild species override', () => {
    const rates = { ...RATES, speciesOverrides: { '1': { wild: 'boosted' as const } } }
    const { rows } = normalizeShinyList([entry('pm1')], rates, speciesNames, BUILD_TIME)
    expect(rows[0]).toMatchObject({ tier: 'boosted', denom: 64 })
  })

  it('reports an entry whose dex has no English name instead of inventing one', () => {
    const { rows, skipped } = normalizeShinyList([{ dex: 9999, aa_fn: 'pm9999', released_date: '2020/01/01' }], RATES, speciesNames, BUILD_TIME)
    expect(rows).toEqual([])
    expect(skipped).toEqual([{ tab: 'all', name: 'dex 9999', image: 'pm9999' }])
  })
})
