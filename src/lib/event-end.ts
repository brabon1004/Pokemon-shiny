import type { Row } from '../shared/contract.ts'
import { parseEventTime } from '../shared/event-time.ts'

type EventWindow = NonNullable<Row['window']>

const DATE_PARTS = { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric' } as const

/**
 * "Until Mon, Nov 23, 8 PM": when a wild row's event ends, in the viewer's timezone, with minutes only when they
 * aren't :00. A local-time event ends at the same wall-clock time everywhere, so its time is shown as written.
 * `viewerTimeZone` defaults to the browser's own; tests pass one explicitly. Null when the end isn't a valid time.
 */
export function formatEventEnd(window: EventWindow, viewerTimeZone?: string): string | null {
  // Reading a wall-clock time as UTC and printing it in UTC reproduces it unchanged.
  const endMs = parseEventTime(window.end, 'utc')
  if (Number.isNaN(endMs)) return null
  const timeZone = window.local ? 'UTC' : viewerTimeZone
  const withMinutes = new Intl.DateTimeFormat('en-US', { ...DATE_PARTS, minute: '2-digit', timeZone })
  const isOnTheHour = withMinutes.formatToParts(endMs).find((part) => part.type === 'minute')?.value === '00'
  const formatter = isOnTheHour ? new Intl.DateTimeFormat('en-US', { ...DATE_PARTS, timeZone }) : withMinutes
  return `Until ${formatter.format(endMs)}`
}
