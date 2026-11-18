import type { Row } from '../shared/contract.ts'
import { parseEventTime } from '../shared/event-time.ts'
import { sortByBestOdds } from './rows.ts'

export interface WildEventGroup {
  /** Unique per event: its name plus its window. */
  key: string
  event: string
  window: Row['window']
  rows: Row[]
}

/**
 * Wild rows grouped by event (the row's `source`), each group's rows by best odds, then by name. Events with a boosted
 * (non-base) row come first, then events ending soonest; an event with no known end goes last.
 */
export function groupWildByEvent(rows: readonly Row[]): WildEventGroup[] {
  const groups = new Map<string, WildEventGroup>()
  for (const row of rows) {
    const key = JSON.stringify([row.source, row.window?.start, row.window?.end, row.window?.local])
    const group = groups.get(key) ?? { key, event: row.source, window: row.window, rows: [] }
    group.rows.push(row)
    groups.set(key, group)
  }
  return [...groups.values()]
    .map((group) => ({ ...group, rows: sortByBestOdds(group.rows.toSorted((a, b) => a.name.localeCompare(b.name))) }))
    .toSorted((a, b) => Number(hasBoostedRow(b)) - Number(hasBoostedRow(a)) || endTime(a) - endTime(b))
}

function hasBoostedRow(group: WildEventGroup): boolean {
  return group.rows.some((row) => row.tier !== null && row.tier !== 'base')
}

function endTime(group: WildEventGroup): number {
  if (group.window === undefined) return Number.POSITIVE_INFINITY
  const end = parseEventTime(group.window.end, group.window.local ? 'viewer' : 'utc')
  return Number.isNaN(end) ? Number.POSITIVE_INFINITY : end
}
