import { fetchText, type FetchOptions } from './fetch-json.ts'
import { parseWildEncounters, type WildEncounter } from './parse-wild-encounters.ts'
import type { GameEvent } from './upstream-schemas.ts'

const EVENT_PAGE_HOST = 'leekduck.com'
const EVENT_PAGE_PATH_PREFIX = '/events/'

/**
 * Event links come from upstream data, so the build only fetches https pages on leekduck.com under /events/. Anything
 * else (another host, a subdomain, credentials, a different path) is refused rather than requested.
 */
export function isAllowedEventPageUrl(link: string): boolean {
  if (!URL.canParse(link)) return false
  const url = new URL(link)
  return (
    url.protocol === 'https:' &&
    url.hostname === EVENT_PAGE_HOST &&
    url.port === '' &&
    url.username === '' &&
    url.password === '' &&
    url.pathname.startsWith(EVENT_PAGE_PATH_PREFIX)
  )
}

export interface EventPageDeps {
  /** GET the page's HTML; rejects on network failure or a non-2xx status. */
  fetchPage: (url: string) => Promise<string>
  warn: (message: string) => void
}

/** Usually one to three events with spawns run at once; the cap bounds build time and requests if upstream misfires. */
export const MAX_EVENT_PAGES_PER_BUILD = 12

/** Caps an event page body so an oversized response cannot stall the build or the HTML parsing. */
export const MAX_EVENT_PAGE_BYTES = 2 * 1024 * 1024

/**
 * GET an event page without following redirects, so the allowlist check on the link covers the page actually read, and
 * refuse bodies over MAX_EVENT_PAGE_BYTES.
 */
export function fetchEventPage(url: string, options: FetchOptions = {}): Promise<string> {
  return fetchText(url, { ...options, redirect: 'manual', maxBodyBytes: MAX_EVENT_PAGE_BYTES })
}

/**
 * Wild encounters from each event's LeekDuck page, keyed by eventID. Pages are fetched one at a time to stay gentle on
 * LeekDuck. A page that can't be used is reported through `warn` and left out; it never fails the build.
 */
export async function fetchEventWildEncounters(
  events: ReadonlyArray<Pick<GameEvent, 'eventID' | 'name' | 'link'>>,
  deps: EventPageDeps,
): Promise<Map<string, WildEncounter[]>> {
  const encountersByEvent = new Map<string, WildEncounter[]>()
  if (events.length > MAX_EVENT_PAGES_PER_BUILD) {
    const leftOut = events.slice(MAX_EVENT_PAGES_PER_BUILD).map((event) => event.name)
    deps.warn(
      `${events.length} events list wild spawns; read the first ${MAX_EVENT_PAGES_PER_BUILD} and skipped ${leftOut.join(', ')}`,
    )
  }
  for (const event of events.slice(0, MAX_EVENT_PAGES_PER_BUILD)) {
    const link = event.link ?? ''
    if (!isAllowedEventPageUrl(link)) {
      deps.warn(`Skipped wild spawns for "${event.name}": its link ${link || '(none)'} is not a leekduck.com event page`)
      continue
    }
    let pageHtml: string
    try {
      pageHtml = await deps.fetchPage(link)
    } catch (error) {
      deps.warn(`Skipped wild spawns for "${event.name}": ${error instanceof Error ? error.message : String(error)}`)
      continue
    }
    const encounters = parseWildEncounters(pageHtml)
    if (encounters.length === 0) {
      // ScrapedDuck says this event has spawns, so an empty list means the page markup changed.
      deps.warn(`Skipped wild spawns for "${event.name}": ${link} lists no wild encounters`)
      continue
    }
    encountersByEvent.set(event.eventID, encounters)
  }
  return encountersByEvent
}
