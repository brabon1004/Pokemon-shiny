import { describe, expect, it } from 'vitest'
import seedRates from '../../../data/rates.json' with { type: 'json' }
import { ratesSchema } from '../../../src/shared/rates.ts'
import raidsFixture from '../__fixtures__/raids.json' with { type: 'json' }
import { raidsSchema } from '../upstream-schemas.ts'
import { normalizeRaids } from './raids.ts'

const RATES = ratesSchema.parse(seedRates)
const RAIDS = raidsSchema.parse(raidsFixture)
const NO_RELEASES: ReadonlySet<string> = new Set()

describe('normalizeRaids', () => {
  it('builds a row per raid boss with the tier-specific rate', () => {
    const { rows } = normalizeRaids(RAIDS, RATES, [], NO_RELEASES)
    expect(rows).toHaveLength(18)
    expect(rows[0]).toEqual({
      key: 'raid:1-Star Raids:Alolan Meowth',
      dex: 52,
      name: 'Alolan Meowth',
      source: '1-star raid',
      shiny: true,
      denom: 64,
      tier: 'boosted',
    })
    expect(rows.find((row) => row.name === 'Darkrai')).toMatchObject({ source: '5-star raid', tier: 'legendary', denom: 20 })
  })

  it('labels shadow bosses as shadow raids of their tier', () => {
    const { rows } = normalizeRaids(RAIDS, RATES, [], NO_RELEASES)
    expect(rows.find((row) => row.name === 'Shadow Tornadus (Incarnate)')).toMatchObject({
      key: 'raid:5-Star Raids:Shadow Tornadus (Incarnate)',
      dex: 641,
      source: 'Shadow 5-star raid',
    })
    expect(rows.find((row) => row.name === 'Mega Banette')?.source).toBe('Mega raid')
  })

  it('skips a boss whose image has no dex and reports it', () => {
    const boss = { name: 'Mystery', tier: '5-Star Raids', canBeShiny: true, image: 'https://x/unknown.png' }
    expect(normalizeRaids([boss], RATES, [], NO_RELEASES)).toEqual({
      rows: [],
      skipped: [{ tab: 'raids', name: 'Mystery', image: 'https://x/unknown.png' }],
      unmappedTiers: [],
    })
  })

  it('keeps only the first row when two bosses share a key', () => {
    const first = { name: 'Golurk', tier: '3-Star Raids', canBeShiny: true, image: 'https://x/pm623.icon.png' }
    const second = { ...first, canBeShiny: false }
    const { rows } = normalizeRaids([first, second], RATES, [], NO_RELEASES)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.shiny).toBe(true)
  })

  it('lists each raid tier rates.json has no default for, once, and rates it as raid:default', () => {
    const boss = (name: string, tier: string) => ({ name, tier, canBeShiny: true, image: 'https://x/pm623.icon.png' })
    const bosses = [boss('Golurk', 'Elite Raids'), boss('Golett', 'Elite Raids'), boss('Golurk', '3-Star Raids'), boss('Golurk', 'Max Raids')]
    const { rows, unmappedTiers } = normalizeRaids(bosses, RATES, [], NO_RELEASES)
    expect(unmappedTiers).toEqual(['Elite Raids', 'Max Raids'])
    expect(rows[0]).toMatchObject({ key: 'raid:Elite Raids:Golurk', tier: 'boosted', denom: 64 })
    expect(normalizeRaids(RAIDS, RATES, [], NO_RELEASES).unmappedTiers).toEqual([])
  })

  it('passes active events through so a Raid Day override applies', () => {
    const rates = { ...RATES, eventOverrides: { 'raid-day': { tier: 'raid_day' as const, dex: [623] } } }
    const boss = { name: 'Golurk', tier: '3-Star Raids', canBeShiny: true, image: 'https://x/pm623.icon.png' }
    expect(normalizeRaids([boss], rates, ['raid-day'], NO_RELEASES).rows[0]).toMatchObject({ tier: 'raid_day', denom: 10 })
  })
  it('rates a boss upstream marks not shiny as shiny when its form is on the released shiny list', () => {
    const boss = { name: 'Golurk', tier: '3-Star Raids', canBeShiny: false, image: 'https://x/pm623.icon.png' }
    expect(normalizeRaids([boss], RATES, [], new Set(['pm623'])).rows[0]).toMatchObject({ shiny: true, tier: 'boosted', denom: 64 })
  })
  it('keeps the upstream flag for shadow bosses, because the shiny list has no shadow entries', () => {
    const boss = { name: 'Shadow Tornadus (Incarnate)', tier: '5-Star Raids', canBeShiny: false, image: 'https://x/pm641.fINCARNATE.icon.png' }
    expect(normalizeRaids([boss], RATES, [], new Set(['pm641.fINCARNATE'])).rows[0]).toMatchObject({ shiny: false })
  })
})
