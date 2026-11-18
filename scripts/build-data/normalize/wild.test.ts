import { describe, expect, it } from 'vitest'
import seedRates from '../../../data/rates.json' with { type: 'json' }
import speciesNames from '../../../data/species-names.json' with { type: 'json' }
import { ratesSchema } from '../../../src/shared/rates.ts'
import eventsFixture from '../__fixtures__/events.json' with { type: 'json' }
import { eventsSchema } from '../upstream-schemas.ts'
import { findActiveEvents, findEventsWithSpawnPages, normalizeWild, type WildSources } from './wild.ts'

const RATES = ratesSchema.parse(seedRates)
const EVENTS = eventsSchema.parse(eventsFixture)
const NO_PAGES: WildSources = { encountersByEvent: new Map(), releasedKeys: new Set() }
const ICONS = 'https://cdn.leekduck.com/assets/img/pokemon_icons'

describe('normalizeWild', () => {
  it("lists every wild encounter from a running event's page at its resolved odds, base included", () => {
    const encountersByEvent = new Map([
      [
        'dynamax-trails-2026',
        [
          { name: 'Bulbasaur', image: `${ICONS}/pokemon_icon_001_00.png`, canBeShiny: true },
          { name: 'Toxtricity (Amped Form)', image: `${ICONS}/pm849.fAMPED.icon.png`, canBeShiny: true },
        ],
      ],
    ])
    const { rows } = normalizeWild(EVENTS, RATES, speciesNames, new Date('2026-11-18T15:00:00Z'), { ...NO_PAGES, encountersByEvent })
    const window = { start: '2026-11-16T10:00:00.000', end: '2026-11-23T20:00:00.000', local: true }
    expect(rows).toEqual([
      { key: 'wild:dynamax-trails-2026:Bulbasaur', dex: 1, name: 'Bulbasaur', source: 'Dynamax Trails', shiny: true, denom: 512, tier: 'base', window },
      {
        key: 'wild:dynamax-trails-2026:Toxtricity (Amped Form)',
        dex: 849,
        name: 'Toxtricity (Amped Form)',
        source: 'Dynamax Trails',
        shiny: true,
        denom: 512,
        tier: 'base',
        window,
      },
    ])
  })

  it('lists Community Day shinies at the comm_day rate while the event runs', () => {
    const { rows } = normalizeWild(EVENTS, RATES, speciesNames, new Date('2026-11-21T15:00:00Z'), NO_PAGES)
    const window = { start: '2026-11-21T14:00:00.000', end: '2026-11-21T17:00:00.000', local: true }
    expect(rows).toEqual([
      { key: 'wild:november-communityday2026:Pawniard', dex: 624, name: 'Pawniard', source: 'Pawniard Community Day', shiny: true, denom: 25, tier: 'comm_day', window },
      { key: 'wild:november-communityday2026:Bisharp', dex: 625, name: 'Bisharp', source: 'Pawniard Community Day', shiny: true, denom: 25, tier: 'comm_day', window },
      { key: 'wild:november-communityday2026:Kingambit', dex: 983, name: 'Kingambit', source: 'Pawniard Community Day', shiny: true, denom: 25, tier: 'comm_day', window },
    ])
  })

  it('marks a page encounter shiny from the released shiny list when the page shows no shiny icon', () => {
    const encountersByEvent = new Map([
      [
        'dynamax-trails-2026',
        [
          { name: 'Wooloo', image: `${ICONS}/pm831.icon.png`, canBeShiny: false },
          { name: 'Falinks', image: `${ICONS}/pm870.icon.png`, canBeShiny: false },
        ],
      ],
    ])
    const sources = { encountersByEvent, releasedKeys: new Set(['pm831']) }
    const { rows } = normalizeWild(EVENTS, RATES, speciesNames, new Date('2026-11-18T15:00:00Z'), sources)
    expect(rows.map((row) => [row.name, row.shiny, row.denom])).toEqual([
      ['Wooloo', true, 512],
      ['Falinks', false, null],
    ])
  })

  it('leaves out season-long spawns, which are the normal wild pool', () => {
    const encountersByEvent = new Map([['season-24-twilight-trails', [{ name: 'Pidgey', image: `${ICONS}/pm16.icon.png`, canBeShiny: true }]]])
    const { rows } = normalizeWild(EVENTS, RATES, speciesNames, new Date('2026-11-18T15:00:00Z'), { ...NO_PAGES, encountersByEvent })
    expect(rows).toEqual([])
  })

  it('lists Community Day spawns that are not featured shinies at their normal odds', () => {
    const event = {
      eventID: 'cd',
      name: 'Pawniard Community Day',
      eventType: 'community-day',
      start: '2026-11-21T14:00:00.000',
      end: '2026-11-21T17:00:00.000',
      extraData: {
        communityday: {
          spawns: [
            { name: 'Pawniard', image: `${ICONS}/pokemon_icon_624_00.png` },
            { name: 'Pidgey', image: `${ICONS}/pokemon_icon_016_00.png` },
          ],
          shinies: [{ name: 'Pawniard', image: `${ICONS}/pokemon_icon_624_00_shiny.png` }],
        },
      },
    }
    const sources = { ...NO_PAGES, releasedKeys: new Set(['pm16']) }
    const { rows } = normalizeWild([event], RATES, speciesNames, new Date('2026-11-21T15:00:00Z'), sources)
    expect(rows.map((row) => [row.name, row.shiny, row.tier, row.denom])).toEqual([
      ['Pawniard', true, 'comm_day', 25],
      ['Pidgey', true, 'base', 512],
    ])
  })

  it('lists every Spotlight Hour species at its resolved odds and leaves out raid battles', () => {
    // Spotlight hour (Grookey, Scorbunny, Sobble) and the Cresselia/Darkrai raid event are both running at this instant.
    const { rows } = normalizeWild(EVENTS, RATES, speciesNames, new Date('2026-11-19T18:30:00Z'), NO_PAGES)
    expect(rows.map((row) => [row.key, row.tier, row.denom])).toEqual([
      ['wild:pokemonspotlighthour2026-11-19:Grookey', 'base', 512],
      ['wild:pokemonspotlighthour2026-11-19:Scorbunny', 'base', 512],
      ['wild:pokemonspotlighthour2026-11-19:Sobble', 'base', 512],
    ])
  })

  it('adds species an eventOverride lists, naming spotlight entries from the event and others from species names', () => {
    const rates = { ...RATES, eventOverrides: { 'pokemonspotlighthour2026-11-19': { tier: 'event' as const, dex: [810, 1] } } }
    const { rows } = normalizeWild(EVENTS, rates, speciesNames, new Date('2026-11-19T18:30:00Z'), NO_PAGES)
    expect(rows.map((row) => [row.key, row.name, row.tier, row.denom, row.source])).toEqual([
      ['wild:pokemonspotlighthour2026-11-19:Grookey', 'Grookey', 'event', 128, 'Grookey, Scorbunny, and Sobble Spotlight Hour'],
      ['wild:pokemonspotlighthour2026-11-19:Scorbunny', 'Scorbunny', 'base', 512, 'Grookey, Scorbunny, and Sobble Spotlight Hour'],
      ['wild:pokemonspotlighthour2026-11-19:Sobble', 'Sobble', 'base', 512, 'Grookey, Scorbunny, and Sobble Spotlight Hour'],
      ['wild:pokemonspotlighthour2026-11-19:Bulbasaur', 'Bulbasaur', 'event', 128, 'Grookey, Scorbunny, and Sobble Spotlight Hour'],
    ])
  })

  it('falls back to the single featured species when a Spotlight Hour has no list', () => {
    const event = {
      eventID: 'spot',
      name: 'Noibat Spotlight Hour',
      eventType: 'pokemon-spotlight-hour',
      start: '2026-11-26T18:00:00.000',
      end: '2026-11-26T19:00:00.000',
      extraData: { spotlight: { name: 'Noibat', canBeShiny: true, image: `${ICONS}/pokemon_icon_714_00.png` } },
    }
    const { rows } = normalizeWild([event], RATES, speciesNames, new Date('2026-11-26T18:30:00Z'), NO_PAGES)
    expect(rows.map((row) => [row.key, row.dex, row.tier])).toEqual([['wild:spot:Noibat', 714, 'base']])
  })

  it('reports a spotlight entry with no dex in its image', () => {
    const event = {
      eventID: 'spot',
      name: 'Spotlight',
      eventType: 'pokemon-spotlight-hour',
      start: '2026-11-19T18:00:00.000',
      end: '2026-11-19T19:00:00.000',
      extraData: { spotlight: { list: [{ name: 'Mystery', canBeShiny: true, image: 'https://x/unknown.png' }] } },
    }
    const { skipped } = normalizeWild([event], RATES, speciesNames, new Date('2026-11-19T18:30:00Z'), NO_PAGES)
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
    const { rows } = normalizeWild([event], RATES, speciesNames, new Date('2026-11-21T15:00:00Z'), NO_PAGES)
    expect(rows.map((row) => [row.key, row.dex, row.name])).toEqual([
      ['wild:grimer-cd:Grimer', 88, 'Grimer'],
      ['wild:grimer-cd:Alolan Grimer', 88, 'Alolan Grimer'],
    ])
  })

  it('reports events whose start or end cannot be parsed instead of dropping them silently', () => {
    const garbled = { eventID: 'garbled', name: 'G', eventType: 'community-day', start: '2026-11-21T14:00:00.000', end: 'next Sunday' }
    const { rows, unparseableEvents } = normalizeWild([garbled, ...EVENTS], RATES, speciesNames, new Date('2026-11-21T15:00:00Z'), NO_PAGES)
    expect(unparseableEvents).toEqual(['garbled (2026-11-21T14:00:00.000 to next Sunday)'])
    expect(rows).toHaveLength(3)
  })

  it('keeps Community Day species at base odds when no rule boosts them', () => {
    const rates = { ...RATES, eventTypeDefaults: {} }
    const { rows } = normalizeWild(EVENTS, rates, speciesNames, new Date('2026-11-21T15:00:00Z'), NO_PAGES)
    expect(rows.map((row) => [row.name, row.tier, row.denom])).toEqual([
      ['Pawniard', 'base', 512],
      ['Bisharp', 'base', 512],
      ['Kingambit', 'base', 512],
    ])
  })

  it.each(['constructor', '__proto__'])('treats inherited key "%s" as an eventID with no override or event-type default', (eventID) => {
    const event = {
      eventID,
      name: 'Spotlight',
      eventType: eventID,
      start: '2026-11-19T18:00:00.000',
      end: '2026-11-19T19:00:00.000',
      extraData: { spotlight: { list: [{ name: 'Grookey', canBeShiny: true, image: 'https://x/pokemon_icon_810_00.png' }] } },
    }
    const { rows } = normalizeWild([event], RATES, speciesNames, new Date('2026-11-19T18:30:00Z'), NO_PAGES)
    expect(rows.map((row) => [row.name, row.tier, row.denom])).toEqual([['Grookey', 'base', 512]])
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
      normalizeWild([event], RATES, speciesNames, new Date(now), NO_PAGES).rows.map((row) => row.key)

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

  describe('findEventsWithSpawnPages', () => {
    it('picks running events whose page lists spawns, leaving out seasons, Community Days, and Spotlight Hours', () => {
      const ids = (now: string) => findEventsWithSpawnPages(EVENTS, new Date(now)).map((event) => event.eventID)
      expect(ids('2026-11-18T15:00:00Z')).toEqual(['minior-showers-leonids-2026', 'dynamax-trails-2026'])
      // The Spotlight Hour is running and says hasSpawns, but its species already come from events.json.
      expect(ids('2026-11-19T18:30:00Z')).toEqual(['minior-showers-leonids-2026', 'dynamax-trails-2026'])
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
