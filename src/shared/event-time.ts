// Shared by the build script (normalize/wild.ts) and the browser (lib/rows.ts), so both read event times one way.

const HAS_OFFSET = /(?:Z|[+-]\d{2}:?\d{2})$/i

/** ScrapedDuck leaves the offset off local-time events, which run at the same wall-clock time in every timezone. */
export function isLocalTime(time: string): boolean {
  return !HAS_OFFSET.test(time)
}

/**
 * A ScrapedDuck time as epoch ms, or NaN if it isn't a time. A local time is read in `localZone`: 'utc' keeps the
 * build independent of the machine's timezone; 'viewer' uses the browser's timezone, which is what local events mean.
 */
export function parseEventTime(time: string, localZone: 'utc' | 'viewer'): number {
  return Date.parse(isLocalTime(time) && localZone === 'utc' ? `${time}Z` : time)
}
