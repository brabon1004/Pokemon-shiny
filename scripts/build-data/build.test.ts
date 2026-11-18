import { describe, expect, it } from 'vitest'
import seedRates from '../../data/rates.json' with { type: 'json' }
import speciesNames from '../../data/species-names.json' with { type: 'json' }
import { combinedSchema } from '../../src/shared/contract.ts'
import { ratesSchema } from '../../src/shared/rates.ts'
import eggsFixture from './__fixtures__/eggs.json' with { type: 'json' }
import eventsFixture from './__fixtures__/events.json' with { type: 'json' }
import shinyListFixture from './__fixtures__/leekduck-shiny.json' with { type: 'json' }
import raidsFixture from './__fixtures__/raids.json' with { type: 'json' }
import researchFixture from './__fixtures__/research.json' with { type: 'json' }
import { buildCombined, type BuildInput } from './build.ts'
import { eggsSchema, eventsSchema, raidsSchema, researchSchema, shinyListSchema } from './upstream-schemas.ts'

const INPUT: BuildInput = {
  rates: ratesSchema.parse(seedRates),
  names: speciesNames,
  raids: raidsSchema.parse(raidsFixture),
  eggs: eggsSchema.parse(eggsFixture),
  research: researchSchema.parse(researchFixture),
  events: eventsSchema.parse(eventsFixture),
  shinyList: shinyListSchema.parse(shinyListFixture),
  encountersByEvent: new Map(),
  now: new Date('2026-11-21T15:00:00Z'),
}
// The fixture shiny list is a 44-entry sample, far below the live minimum of 500.
const FIXTURE_MINIMUMS = { raids: 1, eggs: 1, all: 1 }

describe('buildCombined', () => {
  it('assembles a contract-valid file from the saved upstream samples', () => {
    const { combined, skipped, warnings } = buildCombined(INPUT, FIXTURE_MINIMUMS)
    expect(combinedSchema.parse(combined)).toEqual(combined)
    expect(combined.generatedAt).toBe('2026-11-21T15:00:00.000Z')
    expect(combined.ratesUpdated).toBe('2026-11-18')
    expect({
      wild: combined.wild.length,
      raids: combined.raids.length,
      dynamax: combined.dynamax.length,
      eggs: combined.eggs.length,
      research: combined.research.length,
      all: combined.all.length,
    }).toEqual({ wild: 3, raids: 18, dynamax: 5, eggs: 77, research: 198, all: 42 })
    expect(skipped).toEqual([])
    // Every reward in the saved research sample has canBeShiny: false, as live ScrapedDuck did on 2026-11-18.
    expect(warnings).toEqual([
      'ScrapedDuck research: 0 of 198 rewards flagged shiny upstream; using the LeekDuck shiny list instead',
      'Max Battle events with no boss the build could read from the name (not listed on the Dynamax tab): ' +
        'Eternamax Eternatus Returns (eternamax-eternatus-max-battles-2026)',
    ])
  })

  it('lists the hand-kept Max Battle bosses and warns about a Max Battle event it cannot read', () => {
    const { combined, warnings } = buildCombined(INPUT, FIXTURE_MINIMUMS)
    expect(combined.dynamax.map((row) => [row.name, row.source])).toEqual([
      ['Dynamax Bulbasaur', '1★ Max Battle'],
      ['Dynamax Caterpie', '1★ Max Battle'],
      ['Dynamax Charmander', '1★ Max Battle'],
      ['Dynamax Pikachu', '1★ Max Battle'],
      ['Dynamax Squirtle', '1★ Max Battle'],
    ])
    expect(warnings).toContain(
      'Max Battle events with no boss the build could read from the name (not listed on the Dynamax tab): ' +
        'Eternamax Eternatus Returns (eternamax-eternatus-max-battles-2026)',
    )
  })

  it('marks research rewards shiny from the released shiny list when upstream flags none', () => {
    const { combined } = buildCombined(INPUT, FIXTURE_MINIMUMS)
    const bulbasaur = combined.research.find((row) => row.name === 'Bulbasaur')
    expect(bulbasaur).toMatchObject({ shiny: true, tier: 'base', denom: 512 })
  })

  it('adds the wild encounters read from event pages, checked against the released shiny list', () => {
    const icon = (file: string) => `https://cdn.leekduck.com/assets/img/pokemon_icons/${file}`
    const encountersByEvent = new Map([
      ['dynamax-trails-2026', [{ name: 'Bulbasaur', image: icon('pokemon_icon_001_00.png'), canBeShiny: false }]],
    ])
    const { combined } = buildCombined({ ...INPUT, encountersByEvent }, FIXTURE_MINIMUMS)
    expect(combined.wild.find((row) => row.source === 'Dynamax Trails')).toMatchObject({
      key: 'wild:dynamax-trails-2026:Bulbasaur',
      shiny: true,
      tier: 'base',
      denom: 512,
    })
  })

  it('warns about unmapped raid tiers and events with unparseable dates', () => {
    const eliteBoss = { name: 'Golurk', tier: 'Elite Raids', canBeShiny: true, image: 'https://x/pm623.icon.png' }
    const garbled = { eventID: 'garbled', name: 'G', eventType: 'event', start: 'soon', end: '2026-11-22T00:00:00.000' }
    const { warnings } = buildCombined({ ...INPUT, raids: [...INPUT.raids, eliteBoss], events: [...INPUT.events, garbled] }, FIXTURE_MINIMUMS)
    expect(warnings).toEqual([
      'ScrapedDuck research: 0 of 198 rewards flagged shiny upstream; using the LeekDuck shiny list instead',
      'Max Battle events with no boss the build could read from the name (not listed on the Dynamax tab): ' +
        'Eternamax Eternatus Returns (eternamax-eternatus-max-battles-2026)',
      'Unmapped raid tiers (using raid:default): Elite Raids',
      'Ignored 1 event with unparseable dates: garbled (soon to 2026-11-22T00:00:00.000)',
    ])
  })

  it('fails when a tab is below its minimum row count, listing every short tab', () => {
    expect(() => buildCombined({ ...INPUT, raids: [], eggs: [] }, FIXTURE_MINIMUMS)).toThrow(
      'sanity check failed: raids has 0 rows (minimum 1); eggs has 0 rows (minimum 1)',
    )
    expect(() => buildCombined(INPUT)).toThrow('all has 42 rows (minimum 500)')
  })

  it('fails when the Max Battle list names a dex with no species name', () => {
    const missingno = { name: 'Missingno', dex: 9999, stars: 1, form: 'dynamax' as const }
    const rates = { ...INPUT.rates, maxBattles: { ...INPUT.rates.maxBattles, bosses: [missingno] } }
    expect(() => buildCombined({ ...INPUT, rates }, FIXTURE_MINIMUMS)).toThrow(
      'data/rates.json references dex numbers not in data/species-names.json: maxBattles.bosses 9999',
    )
  })

  it('fails when a Max Battle boss name does not match its dex', () => {
    const misnamed = { name: 'Charmander', dex: 1, stars: 1, form: 'dynamax' as const }
    const rates = { ...INPUT.rates, maxBattles: { ...INPUT.rates.maxBattles, bosses: [misnamed] } }
    expect(() => buildCombined({ ...INPUT, rates }, FIXTURE_MINIMUMS)).toThrow(
      'data/rates.json maxBattles lists "Charmander" as dex 1, but dex 1 is Bulbasaur in data/species-names.json. Fix the name or the dex.',
    )
  })

  it('fails when rates.json overrides reference a dex with no species name', () => {
    const rates = {
      ...INPUT.rates,
      speciesOverrides: { '5000': { wild: 'event' as const } },
      eventOverrides: { cd: { tier: 'event' as const, dex: [1, 6000] } },
    }
    expect(() => buildCombined({ ...INPUT, rates }, FIXTURE_MINIMUMS)).toThrow(
      'data/rates.json references dex numbers not in data/species-names.json: speciesOverrides 5000, eventOverrides.cd 6000',
    )
  })
})
