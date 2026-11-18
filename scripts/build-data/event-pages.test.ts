import { describe, expect, it } from 'vitest'
import {
  fetchEventPage,
  fetchEventWildEncounters,
  isAllowedEventPageUrl,
  MAX_EVENT_PAGE_BYTES,
  MAX_EVENT_PAGES_PER_BUILD,
} from './event-pages.ts'

const ICONS = 'https://cdn.leekduck.com/assets/img/pokemon_icons'
const pageListing = (...names: string[]) =>
  '<h2 id="wild-encounters">Wild Encounters</h2><ul class="pkmn-list-flex">' +
  names.map((name) => `<li class="pkmn-list-item"><img src="${ICONS}/pm1.icon.png" /><div class="pkmn-name">${name}</div></li>`).join('') +
  '</ul>'
const event = (eventID: string, link: string | null = `https://leekduck.com/events/${eventID}/`) => ({
  eventID,
  name: `Event ${eventID}`,
  link,
})

describe('isAllowedEventPageUrl', () => {
  it('allows an https leekduck.com event page', () => {
    expect(isAllowedEventPageUrl('https://leekduck.com/events/dynamax-trails-2026/')).toBe(true)
  })

  it.each([
    ['plain http', 'http://leekduck.com/events/dynamax-trails-2026/'],
    ['another host', 'https://evil.example/events/x/'],
    ['a lookalike subdomain host', 'https://leekduck.com.evil.example/events/x/'],
    ['a subdomain', 'https://www.leekduck.com/events/x/'],
    ['credentials in the URL', 'https://user@evil.example/events/x/'],
    ['a non-event path', 'https://leekduck.com/shiny/pms.json'],
    ['a path that only starts with "events"', 'https://leekduck.com/eventsx/'],
    ['an unparseable URL', 'not a url'],
    ['an empty string', ''],
  ])('rejects %s', (_label, url) => {
    expect(isAllowedEventPageUrl(url)).toBe(false)
  })
})

describe('fetchEventWildEncounters', () => {
  function recorder(pages: Record<string, string | Error>) {
    const requested: string[] = []
    const warnings: string[] = []
    const deps = {
      fetchPage: async (url: string): Promise<string> => {
        requested.push(url)
        const page = pages[url]
        if (page === undefined) throw new Error(`unexpected request for ${url}`)
        if (page instanceof Error) throw page
        return page
      },
      warn: (message: string) => warnings.push(message),
    }
    return { deps, requested, warnings }
  }

  it("returns each event's parsed wild encounters keyed by eventID", async () => {
    const { deps, warnings } = recorder({ 'https://leekduck.com/events/trails/': pageListing('Bulbasaur', 'Charmander') })
    const encounters = await fetchEventWildEncounters([event('trails')], deps)
    expect([...encounters.entries()].map(([id, list]) => [id, list.map((e) => e.name)])).toEqual([
      ['trails', ['Bulbasaur', 'Charmander']],
    ])
    expect(warnings).toEqual([])
  })
  it('skips an event whose link is missing or not a leekduck.com event page, without requesting it', async () => {
    const { deps, requested, warnings } = recorder({})
    const encounters = await fetchEventWildEncounters([event('offsite', 'https://evil.example/events/x/'), event('nolink', null)], deps)
    expect(encounters.size).toBe(0)
    expect(requested).toEqual([])
    expect(warnings).toEqual([
      'Skipped wild spawns for "Event offsite": its link https://evil.example/events/x/ is not a leekduck.com event page',
      'Skipped wild spawns for "Event nolink": its link (none) is not a leekduck.com event page',
    ])
  })
  it('warns about a page that fails to load or lists nothing, then carries on with the next event', async () => {
    const { deps, warnings } = recorder({
      'https://leekduck.com/events/down/': new Error('unable to fetch https://leekduck.com/events/down/: HTTP 404 Not Found (not retried)'),
      'https://leekduck.com/events/empty/': '<h2 id="bonuses">Bonuses</h2>',
      'https://leekduck.com/events/ok/': pageListing('Pikachu'),
    })
    const encounters = await fetchEventWildEncounters([event('down'), event('empty'), event('ok')], deps)
    expect([...encounters.keys()]).toEqual(['ok'])
    expect(warnings).toEqual([
      'Skipped wild spawns for "Event down": unable to fetch https://leekduck.com/events/down/: HTTP 404 Not Found (not retried)',
      'Skipped wild spawns for "Event empty": https://leekduck.com/events/empty/ lists no wild encounters',
    ])
  })
  it(`reads at most ${MAX_EVENT_PAGES_PER_BUILD} pages per build and names the events left out`, async () => {
    const ids = Array.from({ length: MAX_EVENT_PAGES_PER_BUILD + 2 }, (_, index) => `e${index + 1}`)
    const pages = Object.fromEntries(ids.map((id) => [`https://leekduck.com/events/${id}/`, pageListing('Pikachu')]))
    const { deps, requested, warnings } = recorder(pages)
    await fetchEventWildEncounters(ids.map((id) => event(id)), deps)
    expect(requested).toHaveLength(MAX_EVENT_PAGES_PER_BUILD)
    expect(warnings).toEqual([
      `${ids.length} events list wild spawns; read the first ${MAX_EVENT_PAGES_PER_BUILD} and skipped Event e13, Event e14`,
    ])
  })
  it('fetches pages one at a time', async () => {
    let inFlight = 0
    let maxInFlight = 0
    const fetchPage = async (): Promise<string> => {
      inFlight++
      maxInFlight = Math.max(maxInFlight, inFlight)
      await new Promise((resolve) => setTimeout(resolve, 1))
      inFlight--
      return pageListing('Pikachu')
    }
    await fetchEventWildEncounters([event('a'), event('b'), event('c')], { fetchPage, warn: () => {} })
    expect(maxInFlight).toBe(1)
  })
})

describe('fetchEventPage', () => {
  const PAGE = 'https://leekduck.com/events/trails/'
  const noSleep = async (): Promise<void> => {}
  const serve = (response: Response) => async (): Promise<Response> => response

  it('turns a redirect into a skipped event instead of following it', async () => {
    const warnings: string[] = []
    const fetchImpl = serve(new Response(null, { status: 301, headers: { location: 'http://evil.example/' } }))
    const encounters = await fetchEventWildEncounters([event('trails')], {
      fetchPage: (url) => fetchEventPage(url, { fetchImpl, sleep: noSleep }),
      warn: (message) => warnings.push(message),
    })
    expect(encounters.size).toBe(0)
    expect(warnings).toEqual([`Skipped wild spawns for "Event trails": unable to fetch ${PAGE}: redirected to http://evil.example/ (not followed)`])
  })

  it(`skips a page larger than ${MAX_EVENT_PAGE_BYTES} bytes`, async () => {
    expect(MAX_EVENT_PAGE_BYTES).toBe(2 * 1024 * 1024)
    const warnings: string[] = []
    const fetchImpl = serve(new Response(pageListing('Pikachu') + ' '.repeat(MAX_EVENT_PAGE_BYTES)))
    const encounters = await fetchEventWildEncounters([event('trails')], {
      fetchPage: (url) => fetchEventPage(url, { fetchImpl, sleep: noSleep }),
      warn: (message) => warnings.push(message),
    })
    expect(encounters.size).toBe(0)
    expect(warnings).toEqual([
      `Skipped wild spawns for "Event trails": unable to fetch ${PAGE}: body is over ${MAX_EVENT_PAGE_BYTES} bytes (not retried)`,
    ])
  })
})
