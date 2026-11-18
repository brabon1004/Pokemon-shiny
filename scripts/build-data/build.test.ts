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
      eggs: combined.eggs.length,
      research: combined.research.length,
      all: combined.all.length,
    }).toEqual({ wild: 3, raids: 18, eggs: 77, research: 198, all: 42 })
    expect(skipped).toEqual([])
    expect(warnings).toEqual([])
  })

  it('warns about unmapped raid tiers and events with unparseable dates', () => {
    const eliteBoss = { name: 'Golurk', tier: 'Elite Raids', canBeShiny: true, image: 'https://x/pm623.icon.png' }
    const garbled = { eventID: 'garbled', name: 'G', eventType: 'event', start: 'soon', end: '2026-11-22T00:00:00.000' }
    const { warnings } = buildCombined({ ...INPUT, raids: [...INPUT.raids, eliteBoss], events: [...INPUT.events, garbled] }, FIXTURE_MINIMUMS)
    expect(warnings).toEqual([
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
