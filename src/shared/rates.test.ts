import { describe, expect, it } from 'vitest'
import rates from '../../data/rates.json' with { type: 'json' }
import { ratesSchema } from './rates.ts'

describe('ratesSchema', () => {
  it('accepts data/rates.json with the seeded tiers and defaults', () => {
    const parsed = ratesSchema.parse(rates)
    expect(parsed.updated).toBe('2026-11-18')
    expect(Object.fromEntries(Object.entries(parsed.tiers).map(([tier, info]) => [tier, info.denom]))).toEqual({
      base: 512,
      event: 128,
      boosted: 64,
      comm_day: 25,
      legendary: 20,
      raid_day: 10,
      dynamax: 64,
      gigantamax: 64,
    })
    expect(parsed.tiers.dynamax.unverified).toBe(true)
    expect(parsed.tiers.gigantamax.unverified).toBe(true)
    expect(parsed.encounterDefaults).toEqual({
      wild: 'base',
      research: 'base',
      egg: 'boosted',
      'raid:1-Star Raids': 'boosted',
      'raid:3-Star Raids': 'boosted',
      'raid:Mega Raids': 'boosted',
      'raid:5-Star Raids': 'legendary',
      'raid:default': 'boosted',
      'max:dynamax': 'dynamax',
      'max:gigantamax': 'gigantamax',
    })
    expect(parsed.eventTypeDefaults).toEqual({ 'community-day': 'comm_day' })
  })

  it('seeds the hand-kept Max Battle list with five 1-star Dynamax bosses', () => {
    const { maxBattles } = ratesSchema.parse(rates)
    expect(maxBattles.until).toBe('2026-11-23')
    expect(maxBattles.bosses.map((boss) => [boss.dex, boss.name, boss.stars, boss.form])).toEqual([
      [1, 'Bulbasaur', 1, 'dynamax'],
      [4, 'Charmander', 1, 'dynamax'],
      [7, 'Squirtle', 1, 'dynamax'],
      [10, 'Caterpie', 1, 'dynamax'],
      [25, 'Pikachu', 1, 'dynamax'],
    ])
  })

  it('accepts a Max Battle list with no end date', () => {
    const maxBattles = { updated: '2026-11-18', until: null, bosses: [] }
    expect(ratesSchema.parse({ ...rates, maxBattles }).maxBattles.until).toBeNull()
  })

  it.each([
    ['stars below 1', { stars: 0 }],
    ['stars above 6', { stars: 7 }],
    ['fractional stars', { stars: 1.5 }],
    ['a dex of 0', { dex: 0 }],
    ['an unknown form', { form: 'mega' }],
  ])('rejects a Max Battle boss with %s', (_case, change) => {
    const boss = { name: 'Bulbasaur', dex: 1, stars: 1, form: 'dynamax', ...change }
    const result = ratesSchema.safeParse({ ...rates, maxBattles: { ...rates.maxBattles, bosses: [boss] } })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path.slice(0, 3)).toEqual(['maxBattles', 'bosses', 0])
  })

  it('requires the fallback encounter defaults', () => {
    const { 'raid:default': _omitted, ...withoutRaidDefault } = rates.encounterDefaults
    const result = ratesSchema.safeParse({ ...rates, encounterDefaults: withoutRaidDefault })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['encounterDefaults', 'raid:default'])
  })

  it('accepts species and event overrides keyed by dex and event id', () => {
    const parsed = ratesSchema.parse({
      ...rates,
      speciesOverrides: { '382': { 'raid:5-Star Raids': 'raid_day' } },
      eventOverrides: { 'festival-of-lights-2026': { tier: 'event', dex: [607, 608] } },
    })
    expect(parsed.speciesOverrides['382']).toEqual({ 'raid:5-Star Raids': 'raid_day' })
    expect(parsed.eventOverrides['festival-of-lights-2026']).toEqual({ tier: 'event', dex: [607, 608] })
  })

  it('rejects a species override keyed by a name instead of a dex number', () => {
    const result = ratesSchema.safeParse({ ...rates, speciesOverrides: { kyogre: { wild: 'event' } } })
    expect(result.success).toBe(false)
  })

  it('rejects an override pointing at an unknown tier', () => {
    const result = ratesSchema.safeParse({ ...rates, eventOverrides: { x: { tier: 'mythic', dex: [1] } } })
    expect(result.success).toBe(false)
  })
})
