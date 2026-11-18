const MINUTE_MS = 60_000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS

function plural(count: number, unit: string): string {
  return `${count} ${unit}${count === 1 ? '' : 's'}`
}

/** "Updated 2 hours ago" for an ISO timestamp, measured from `now`. */
export function formatUpdatedAgo(isoTimestamp: string, now: Date): string {
  const updatedAt = Date.parse(isoTimestamp)
  if (Number.isNaN(updatedAt)) return 'Update time unknown'
  const elapsed = now.getTime() - updatedAt
  if (elapsed < MINUTE_MS) return 'Updated just now'
  if (elapsed < HOUR_MS) return `Updated ${plural(Math.floor(elapsed / MINUTE_MS), 'minute')} ago`
  if (elapsed < DAY_MS) return `Updated ${plural(Math.floor(elapsed / HOUR_MS), 'hour')} ago`
  return `Updated ${plural(Math.floor(elapsed / DAY_MS), 'day')} ago`
}
