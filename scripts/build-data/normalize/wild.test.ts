import { describe, expect, it } from 'vitest'
import seedRates from '../../../data/rates.json' with { type: 'json' }
import speciesNames from '../../../data/species-names.json' with { type: 'json' }
import { ratesSchema } from '../../../src/shared/rates.ts'
import eventsFixture from '../__fixtures__/events.json' with { type: 'json' }
import { eventsSchema } from '../upstream-schemas.ts'
import { findActiveEvents, normalizeWild } from './wild.ts'

const RATES = ratesSchema.parse(seedRates)
const EVENTS = eventsSchema.parse(eventsFixture)

describe('normalizeWild', () => {
  it('lists Community Day shinies at the comm_day rate while the event runs', () => {
    const { rows } = normalizeWild(EVENTS, RATES, speciesNames, new Date('2026-11-21T15:00:00Z'))
    const window = { start: '2026-11-21T14:00:00.000', end: '2026-11-21T17:00:00.000', local: true }
    expect(rows).toEqual([
      { key: 'wild:november-communityday2026:Pawniard', dex: 624, name: 'Pawniard', source: 'Pawniard Community Day', shiny: true, denom: 25, tier: 'comm_day', window },
      { key: 'wild:november-communityday2026:Bisharp', dex: 625, name: 'Bisharp', source: 'Pawniard Community Day', shiny: true, denom: 25, tier: 'comm_day', window },
      { key: 'wild:november-communityday2026:Kingambit', dex: 983, name: 'Kingambit', source: 'Pawniard Community Day', shiny: true, denom: 25, tier: 'comm_day', window },
    ])
  })

  it('leaves out Spotlight Hours, raid battles, and other events no override lists', () => {
    // Spotlight hour (Grookey) and the Cresselia/Darkrai raid event are both running at this instant.
    expect(normalizeWild(EVENTS, RATES, speciesNames, new Date('2026-11-19T18:30:00Z')).rows).toEqual([])
  })

  it('adds species an eventOverride lists, naming spotlight entries from the event and others from species names', () => {
    const rates = { ...RATES, eventOverrides: { 'pokemonspotlighthour2026-11-19': { tier: 'event' as const, dex: [810, 1] } } }
    const { rows } = normalizeWild(EVENTS, rates, speciesNames, new Date('2026-11-19T18:30:00Z'))
    expect(rows.map((row) => [row.key, row.name, row.tier, row.denom, row.source])).toEqual([
      ['wild:pokemonspotlighthour2026-11-19:Grookey', 'Grookey', 'event', 128, 'Grookey, Scorbunny, and Sobble Spotlight Hour'],
      ['wild:pokemonspotlighthour2026-11-19:Bulbasaur', 'Bulbasaur', 'event', 128, 'Grookey, Scorbunny, and Sobble Spotlight Hour'],
    ])
  })

  it('reports a spotlight entry with no dex in its image when the event has an override', () => {
    const rates = { ...RATES, eventOverrides: { spot: { tier: 'event' as const, dex: [1] } } }
    const event = {
      eventID: 'spot',
      name: 'Spotlight',
      eventType: 'pokemon-spotlight-hour',
      start: '2026-11-19T18:00:00.000',
      end: '2026-11-19T19:00:00.000',
      extraData: { spotlight: { list: [{ name: 'Mystery', canBeShiny: true, image: 'https://x/unknown.png' }] } },
    }
    const { skipped } = normalizeWild([event], rates, speciesNames, new Date('2026-11-19T18:30:00Z'))
    expect(skipped).toEqual([{ tab: 'wild', name: 'Mystery', image: 'https://x/unknown.png' }])
  })

  it('keeps two forms of one species from the same event as separate rows', () => {
    const icon = (file: string) => ({ name: '', image: `https://cdn.leekduck.com/assets/img/pokemon_icons/${file}` })
    const event = {
      eventID: 'grimer-cd',
      name: 'Grimer Community Day',
      eventType: 'community-day',
      start: '2026-11-21T14:00:00.000',
      end: '2026-11-21T17:00:00.000',
      extraData: {
        communityday: {
          shinies: [
            { ...icon('pokemon_icon_088_00_shiny.png'), name: 'Grimer' },
            { ...icon('pm88.fALOLA.s.icon.png'), name: 'Alolan Grimer' },
          ],
        },
      },
    }
    const { rows } = normalizeWild([event], RATES, speciesNames, new Date('2026-11-21T15:00:00Z'))
    expect(rows.map((row) => [row.key, row.dex, row.name])).toEqual([
      ['wild:grimer-cd:Grimer', 88, 'Grimer'],
      ['wild:grimer-cd:Alolan Grimer', 88, 'Alolan Grimer'],
    ])
  })

  it('reports events whose start or end cannot be parsed instead of dropping them silently', () => {
    const garbled = { eventID: 'garbled', name: 'G', eventType: 'community-day', start: '2026-11-21T14:00:00.000', end: 'next Sunday' }
    const { rows, unparseableEvents } = normalizeWild([garbled, ...EVENTS], RATES, speciesNames, new Date('2026-11-21T15:00:00Z'))
    expect(unparseableEvents).toEqual(['garbled (2026-11-21T14:00:00.000 to next Sunday)'])
    expect(rows).toHaveLength(3)
  })

  it('drops rows whose resolved rate is no better than base', () => {
    const rates = { ...RATES, eventTypeDefaults: {} }
    expect(normalizeWild(EVENTS, rates, speciesNames, new Date('2026-11-21T15:00:00Z')).rows).toEqual([])
  })

  it.each(['constructor', '__proto__'])('treats inherited key "%s" as an eventID with no override', (eventID) => {
    const event = {
      eventID,
      name: 'Spotlight',
      eventType: eventID,
      start: '2026-11-19T18:00:00.000',
      end: '2026-11-19T19:00:00.000',
      extraData: { spotlight: { list: [{ name: 'Grookey', canBeShiny: true, image: 'https://x/pokemon_icon_810_00.png' }] } },
    }
    expect(normalizeWild([event], RATES, speciesNames, new Date('2026-11-19T18:30:00Z')).rows).toEqual([])
  })

  describe('look-ahead for events starting before the next scheduled build', () => {
    const shinies = [{ name: 'Pawniard', image: 'https://cdn.leekduck.com/assets/img/pokemon_icons/pokemon_icon_624_00_shiny.png' }]
    const cd = (start: string, end: string) => ({
      eventID: 'cd',
      name: 'CD',
      eventType: 'community-day',
      start,
      end,
      extraData: { communityday: { shinies } },
    })
    const keys = (event: ReturnType<typeof cd>, now: string) =>
      normalizeWild([event], RATES, speciesNames, new Date(now)).rows.map((row) => row.key)

    it('includes a UTC event starting within 6 hours', () => {
      const utc = cd('2026-11-21T14:00:00.000Z', '2026-11-21T17:00:00.000Z')
      expect(keys(utc, '2026-11-21T08:00:00Z')).toEqual(['wild:cd:Pawniard'])
      expect(keys(utc, '2026-11-21T07:59:59Z')).toEqual([])
    })

    it('adds the 6 hours on top of the 14-hour widening for local-time events', () => {
      const local = cd('2026-11-21T14:00:00.000', '2026-11-21T17:00:00.000')
      expect(keys(local, '2026-11-20T18:00:00Z')).toEqual(['wild:cd:Pawniard'])
      expect(keys(local, '2026-11-20T17:59:59Z')).toEqual([])
    })

    it('does not extend past the end of an event', () => {
      const utc = cd('2026-11-21T14:00:00.000Z', '2026-11-21T17:00:00.000Z')
      expect(keys(utc, '2026-11-21T17:00:00Z')).toEqual(['wild:cd:Pawniard'])
      expect(keys(utc, '2026-11-21T17:00:01Z')).toEqual([])
    })
  })

  describe('findActiveEvents', () => {
    const localEvent = { eventID: 'local', name: 'L', eventType: 'event', start: '2026-11-21T14:00:00.000', end: '2026-11-21T17:00:00.000' }
    const utcEvent = { eventID: 'utc', name: 'U', eventType: 'event', start: '2026-11-21T14:00:00.000Z', end: '2026-11-21T17:00:00.000Z' }
    const ids = (now: string) => findActiveEvents([localEvent, utcEvent], new Date(now)).map((event) => event.eventID)

    it('widens local-time events by 14 hours on each side to cover every timezone', () => {
      expect(ids('2026-11-21T00:00:00Z')).toEqual(['local']) // 14:00 in UTC+14
      expect(ids('2026-11-22T07:00:00Z')).toEqual(['local']) // end + 14 h (UTC-12 needs only 12)
      expect(ids('2026-11-20T23:59:59Z')).toEqual([])
      expect(ids('2026-11-22T07:00:01Z')).toEqual([])
    })

    it('matches UTC events against the exact window', () => {
      expect(ids('2026-11-21T13:59:59Z')).toEqual(['local'])
      expect(ids('2026-11-21T14:00:00Z')).toEqual(['local', 'utc'])
      expect(ids('2026-11-21T17:00:01Z')).toEqual(['local'])
    })

    it('ignores events with no start or end', () => {
      const undated = { ...localEvent, start: null }
      expect(findActiveEvents([undated], new Date('2026-11-21T15:00:00Z'))).toEqual([])
    })
  })
})
