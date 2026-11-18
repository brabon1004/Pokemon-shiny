import { describe, expect, it } from 'vitest'
import seedRates from '../../data/rates.json' with { type: 'json' }
import { ratesSchema, type Rates } from '../../src/shared/rates.ts'
import { resolveTier } from './resolve-tier.ts'

const SEED = ratesSchema.parse(seedRates)

function ratesWith(overrides: Partial<Rates>): Rates {
  return { ...SEED, ...overrides }
}

describe('resolveTier', () => {
  it('uses encounterDefaults for the encounter type', () => {
    expect(resolveTier(SEED, { dex: 1, encounterType: 'egg', canBeShiny: true })).toEqual({
      shiny: true,
      tier: 'boosted',
      denom: 64,
    })
  })

  it('falls back to raid:default for a raid tier rates.json does not list', () => {
    const rates = ratesWith({ encounterDefaults: { ...SEED.encounterDefaults, 'raid:default': 'event' } })
    expect(resolveTier(rates, { dex: 150, encounterType: 'raid:Elite Raids', canBeShiny: true })).toEqual({
      shiny: true,
      tier: 'event',
      denom: 128,
    })
  })

  it('throws a descriptive error for an encounter type that has no default', () => {
    expect(() => resolveTier(SEED, { dex: 1, encounterType: 'trade', canBeShiny: true })).toThrow(
      /no encounterDefaults entry for "trade"/,
    )
  })

  it('uses eventTypeDefaults over encounterDefaults for an event-sourced row', () => {
    const query = { dex: 624, encounterType: 'wild', canBeShiny: true, event: { eventID: 'cd', eventType: 'community-day' } }
    expect(resolveTier(SEED, query)).toEqual({ shiny: true, tier: 'comm_day', denom: 25 })
  })

  it('falls through to encounterDefaults when the event type has no default', () => {
    const query = { dex: 624, encounterType: 'wild', canBeShiny: true, event: { eventID: 'x', eventType: 'max-mondays' } }
    expect(resolveTier(SEED, query)).toEqual({ shiny: true, tier: 'base', denom: 512 })
  })

  it('uses speciesOverrides for the dex and encounter type over eventTypeDefaults', () => {
    const rates = ratesWith({ speciesOverrides: { '624': { wild: 'event' } } })
    const query = { dex: 624, encounterType: 'wild', canBeShiny: true, event: { eventID: 'cd', eventType: 'community-day' } }
    expect(resolveTier(rates, query)).toEqual({ shiny: true, tier: 'event', denom: 128 })
  })

  it('ignores a species override written for a different encounter type', () => {
    const rates = ratesWith({ speciesOverrides: { '624': { egg: 'event' } } })
    expect(resolveTier(rates, { dex: 624, encounterType: 'wild', canBeShiny: true })).toEqual({
      shiny: true,
      tier: 'base',
      denom: 512,
    })
  })

  it('uses an eventOverride listing the dex over speciesOverrides', () => {
    const rates = ratesWith({
      speciesOverrides: { '624': { wild: 'event' } },
      eventOverrides: { cd: { tier: 'raid_day', dex: [624] } },
    })
    const query = { dex: 624, encounterType: 'wild', canBeShiny: true, event: { eventID: 'cd', eventType: 'community-day' } }
    expect(resolveTier(rates, query)).toEqual({ shiny: true, tier: 'raid_day', denom: 10 })
  })

  it('ignores an eventOverride that does not list the dex', () => {
    const rates = ratesWith({ eventOverrides: { cd: { tier: 'raid_day', dex: [625] } } })
    const query = { dex: 624, encounterType: 'wild', canBeShiny: true, event: { eventID: 'cd', eventType: 'community-day' } }
    expect(resolveTier(rates, query)).toEqual({ shiny: true, tier: 'comm_day', denom: 25 })
  })

  it('applies an override from any active event to a row with no source event (Raid Day bosses)', () => {
    const rates = ratesWith({ eventOverrides: { 'raid-day': { tier: 'raid_day', dex: [36] } } })
    const query = { dex: 36, encounterType: 'raid:Mega Raids', canBeShiny: true, activeEventIDs: ['other', 'raid-day'] }
    expect(resolveTier(rates, query)).toEqual({ shiny: true, tier: 'raid_day', denom: 10 })
  })

  it('returns no tier or odds when the encounter cannot be shiny, even with an override', () => {
    const rates = ratesWith({ eventOverrides: { cd: { tier: 'raid_day', dex: [1] } } })
    const query = { dex: 1, encounterType: 'research', canBeShiny: false, activeEventIDs: ['cd'] }
    expect(resolveTier(rates, query)).toEqual({ shiny: false, tier: null, denom: null })
  })

  it.each(['constructor', '__proto__', 'toString'])('treats inherited key "%s" as an absent eventID or eventType', (key) => {
    const query = { dex: 1, encounterType: 'wild', canBeShiny: true, event: { eventID: key, eventType: key }, activeEventIDs: [key] }
    expect(resolveTier(SEED, query)).toEqual(resolveTier(SEED, { dex: 1, encounterType: 'wild', canBeShiny: true }))
  })
})
