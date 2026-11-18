import type { Row } from '../shared/contract.ts'
import { parseEventTime } from '../shared/event-time.ts'

type EventWindow = NonNullable<Row['window']>

/** Best odds (smallest 1-in-N) first; rows with no shiny go last. Stable, so ties keep data order. */
export function sortByBestOdds(rows: readonly Row[]): Row[] {
  return rows.toSorted((a, b) => (a.denom ?? Number.POSITIVE_INFINITY) - (b.denom ?? Number.POSITIVE_INFINITY))
}

function foldForSearch(text: string): string {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
}

/** Case- and accent-insensitive substring match on the display name. */
export function filterByName(rows: readonly Row[], query: string): Row[] {
  const needle = foldForSearch(query.trim())
  if (needle === '') return [...rows]
  return rows.filter((row) => foldForSearch(row.name).includes(needle))
}

/** True when `now` falls in [start, end). Unparseable times count as inactive. */
export function isWindowActive(window: EventWindow, now: Date): boolean {
  const zone = window.local ? 'viewer' : 'utc'
  const start = parseEventTime(window.start, zone)
  const end = parseEventTime(window.end, zone)
  const instant = now.getTime()
  return instant >= start && instant < end
}

/** Wild rows live at `now`. A row without a window has no end we know of, so it stays listed. */
export function selectActiveWild(rows: readonly Row[], now: Date): Row[] {
  return rows.filter((row) => row.window === undefined || isWindowActive(row.window, now))
}
