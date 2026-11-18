import { describe, expect, it } from 'vitest'
import seedRates from '../../../data/rates.json' with { type: 'json' }
import speciesNames from '../../../data/species-names.json' with { type: 'json' }
import { ratesSchema, type MaxBattleBoss, type Rates } from '../../../src/shared/rates.ts'
import type { GameEvent } from '../upstream-schemas.ts'
import { MAX_EVENT_NAME_LENGTH, normalizeMaxBattles, type MaxBattleSources } from './max-battles.ts'

const SEED_RATES = ratesSchema.parse(seedRates)
const NOW = new Date('2026-11-18T15:00:00Z')
const ALL_SHINY: MaxBattleSources = { releasedKeys: new Set(['pm1', 'pm4', 'pm25', 'pm25.fGIGANTAMAX', 'pm677']), activeEventIDs: [] }

function ratesWithBosses(bosses: MaxBattleBoss[], until: string | null = '2026-11-23'): Rates {
  return { ...SEED_RATES, maxBattles: { updated: '2026-11-18', until, bosses } }
}

function maxEvent(eventID: string, name: string, eventType = 'max-mondays'): GameEvent {
  return { eventID, name, eventType, start: '2026-11-18T06:00:00.000', end: '2026-11-18T21:00:00.000', link: null, extraData: null }
}

describe('normalizeMaxBattles', () => {
  it('lists the hand-kept bosses as "1★ Max Battle" rows at the unverified Dynamax rate', () => {
    const rates = ratesWithBosses([{ name: 'Bulbasaur', dex: 1, stars: 1, form: 'dynamax' }])
    const { rows, warnings } = normalizeMaxBattles([], rates, speciesNames, NOW, ALL_SHINY)
    expect(rows).toEqual([
      {
        key: 'dynamax:list:Dynamax Bulbasaur',
        dex: 1,
        name: 'Dynamax Bulbasaur',
        source: '1★ Max Battle',
        shiny: true,
        denom: 64,
        tier: 'dynamax',
        window: { start: '2026-11-18T00:00:00.000', end: '2026-11-24T00:00:00.000', local: true },
      },
    ])
    expect(warnings).toEqual([])
  })

  it('counts Dynamax as shiny from the base form and Gigantamax only from its own released form', () => {
    const rates = ratesWithBosses([
      { name: 'Squirtle', dex: 7, stars: 1, form: 'dynamax' },
      { name: 'Pikachu', dex: 25, stars: 1, form: 'dynamax' },
      { name: 'Pikachu', dex: 25, stars: 6, form: 'gigantamax' },
      { name: 'Charmander', dex: 4, stars: 6, form: 'gigantamax' },
    ])
    const { rows } = normalizeMaxBattles([], rates, speciesNames, NOW, ALL_SHINY)
    expect(Object.fromEntries(rows.map((row) => [row.name, row.tier]))).toEqual({
      'Dynamax Squirtle': null,
      'Dynamax Pikachu': 'dynamax',
      'Gigantamax Pikachu': 'gigantamax',
      'Gigantamax Charmander': null,
    })
  })

  it('keeps the hand-kept list until "until" has ended in every timezone, then drops it and warns', () => {
    const rates = ratesWithBosses([{ name: 'Bulbasaur', dex: 1, stars: 1, form: 'dynamax' }], '2026-11-18')
    // 23:59 UTC on Nov 19 is still Nov 18 (or later) nowhere west of UTC−12; the browser window does the exact cutoff.
    expect(normalizeMaxBattles([], rates, speciesNames, new Date('2026-11-19T23:59:00Z'), ALL_SHINY).rows).toHaveLength(1)
    const { rows, warnings } = normalizeMaxBattles([], rates, speciesNames, new Date('2026-11-20T00:00:00Z'), ALL_SHINY)
    expect(rows).toEqual([])
    expect(warnings).toEqual(['maxBattles list expired on 2026-11-18; update the bosses and "until" in data/rates.json'])
  })

  it('adds the boss named by a running Max Monday or Max Battle Day event, with its window', () => {
    const events = [
      maxEvent('max-mondays-2026-11-18', 'Dynamax Espurr during Max Monday'),
      maxEvent('gmax-pikachu-day', 'Gigantamax Pikachu Max Battle Day', 'max-battles'),
      maxEvent('gmax-short', 'G-Max pikachu Max Battles', 'max-battles'),
    ]
    const { rows, warnings } = normalizeMaxBattles(events, ratesWithBosses([]), speciesNames, NOW, ALL_SHINY)
    const window = { start: '2026-11-18T06:00:00.000', end: '2026-11-18T21:00:00.000', local: true }
    expect(rows).toEqual([
      {
        key: 'dynamax:max-mondays-2026-11-18:Dynamax Espurr',
        dex: 677,
        name: 'Dynamax Espurr',
        source: 'Dynamax Espurr during Max Monday',
        shiny: true,
        denom: 64,
        tier: 'dynamax',
        window,
      },
      {
        key: 'dynamax:gmax-pikachu-day:Gigantamax Pikachu',
        dex: 25,
        name: 'Gigantamax Pikachu',
        source: 'Gigantamax Pikachu Max Battle Day',
        shiny: true,
        denom: 64,
        tier: 'gigantamax',
        window,
      },
      {
        key: 'dynamax:gmax-short:Gigantamax Pikachu',
        dex: 25,
        name: 'Gigantamax Pikachu',
        source: 'G-Max pikachu Max Battles',
        shiny: true,
        denom: 64,
        tier: 'gigantamax',
        window,
      },
    ])
    expect(warnings).toEqual([])
  })

  it('skips a Max Battle event whose name names no known species, warning with the event', () => {
    const events = [
      maxEvent('max-battle-day-december-2026', 'Max Battle Day', 'max-battles'),
      maxEvent('eternamax-eternatus-max-battles-2026', 'Eternamax Eternatus Returns', 'max-battles'),
      maxEvent('max-mondays-typo', 'Dynamax Espur during Max Monday'),
    ]
    const { rows, warnings } = normalizeMaxBattles(events, ratesWithBosses([]), speciesNames, NOW, ALL_SHINY)
    expect(rows).toEqual([])
    expect(warnings).toEqual([
      'Max Battle events with no boss the build could read from the name (not listed on the Dynamax tab): ' +
        'Max Battle Day (max-battle-day-december-2026); Eternamax Eternatus Returns (eternamax-eternatus-max-battles-2026); ' +
        'Dynamax Espur during Max Monday (max-mondays-typo)',
    ])
  })

  it('skips an overlong event name in well under a second instead of backtracking on it', () => {
    // Spaces then an interior newline made the old pattern retry every split: 4,000 spaces took about 7 s.
    const hostileName = `Dynamax${' '.repeat(4_000)}b
c`
    const events = [maxEvent('max-mondays-hostile', hostileName)]
    const startedMs = performance.now()
    const { rows, warnings } = normalizeMaxBattles(events, ratesWithBosses([]), speciesNames, NOW, ALL_SHINY)
    expect(performance.now() - startedMs).toBeLessThan(1_000)
    expect(rows).toEqual([])
    expect(warnings).toEqual([
      `Max Battle event max-mondays-hostile has a name over ${MAX_EVENT_NAME_LENGTH} characters; not read (not listed on the Dynamax tab)`,
    ])
  })

  it('ignores other event types and Max Battle events that are over', () => {
    const over = { ...maxEvent('max-mondays-old', 'Dynamax Espurr during Max Monday'), end: '2026-11-10T21:00:00.000' }
    const events = [maxEvent('trails', 'Dynamax Espurr during Max Monday', 'event'), over]
    expect(normalizeMaxBattles(events, ratesWithBosses([]), speciesNames, NOW, ALL_SHINY)).toEqual({ rows: [], warnings: [] })
  })

  it('applies species overrides by max:<form> and event overrides from the source or an active event', () => {
    const rates: Rates = {
      ...ratesWithBosses([
        { name: 'Bulbasaur', dex: 1, stars: 1, form: 'dynamax' },
        { name: 'Charmander', dex: 4, stars: 1, form: 'dynamax' },
      ]),
      speciesOverrides: { '1': { 'max:dynamax': 'event' } },
      eventOverrides: { 'max-mondays-2026-11-18': { tier: 'raid_day', dex: [677] }, 'raid-day': { tier: 'legendary', dex: [4] } },
    }
    const events = [maxEvent('max-mondays-2026-11-18', 'Dynamax Espurr during Max Monday')]
    const { rows } = normalizeMaxBattles(events, rates, speciesNames, NOW, { ...ALL_SHINY, activeEventIDs: ['raid-day'] })
    expect(Object.fromEntries(rows.map((row) => [row.name, row.tier]))).toEqual({
      'Dynamax Bulbasaur': 'event',
      'Dynamax Charmander': 'legendary',
      'Dynamax Espurr': 'raid_day',
    })
  })

  it('orders bosses by star tier then name, with event bosses after the hand-kept list', () => {
    const rates = ratesWithBosses([
      { name: 'Pikachu', dex: 25, stars: 6, form: 'gigantamax' },
      { name: 'Pikachu', dex: 25, stars: 1, form: 'dynamax' },
      { name: 'Bulbasaur', dex: 1, stars: 1, form: 'dynamax' },
    ])
    const events = [maxEvent('max-mondays-2026-11-18', 'Dynamax Espurr during Max Monday')]
    const { rows } = normalizeMaxBattles(events, rates, speciesNames, NOW, ALL_SHINY)
    expect(rows.map((row) => row.name)).toEqual(['Dynamax Bulbasaur', 'Dynamax Pikachu', 'Gigantamax Pikachu', 'Dynamax Espurr'])
  })

  it('lists a boss entered twice in the hand-kept list once', () => {
    const bulbasaur = { name: 'Bulbasaur', dex: 1, stars: 1, form: 'dynamax' } as const
    const { rows } = normalizeMaxBattles([], ratesWithBosses([bulbasaur, bulbasaur]), speciesNames, NOW, ALL_SHINY)
    expect(rows.map((row) => row.key)).toEqual(['dynamax:list:Dynamax Bulbasaur'])
  })

  it('gives hand-kept bosses a local window from the updated date through the end of "until"', () => {
    const rates = ratesWithBosses([{ name: 'Bulbasaur', dex: 1, stars: 1, form: 'dynamax' }], '2026-11-30')
    const { rows } = normalizeMaxBattles([], rates, speciesNames, NOW, ALL_SHINY)
    expect(rows.map((row) => row.window)).toEqual([{ start: '2026-11-18T00:00:00.000', end: '2026-12-01T00:00:00.000', local: true }])
  })

  it('keeps a hand-kept list with no end date, with no window', () => {
    const rates = ratesWithBosses([{ name: 'Bulbasaur', dex: 1, stars: 1, form: 'dynamax' }], null)
    const { rows } = normalizeMaxBattles([], rates, speciesNames, new Date('2030-01-01T00:00:00Z'), ALL_SHINY)
    expect(rows.map((row) => [row.name, row.window])).toEqual([['Dynamax Bulbasaur', undefined]])
  })
})
