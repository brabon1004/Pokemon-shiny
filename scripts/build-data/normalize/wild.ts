import type { Row } from '../../../src/shared/contract.ts'
import { isLocalTime, parseEventTime } from '../../../src/shared/event-time.ts'
import type { Rates } from '../../../src/shared/rates.ts'
import { parseDex } from '../dex.ts'
import type { SpeciesNames } from '../names.ts'
import { ownValue, resolveTier } from '../resolve-tier.ts'
import type { GameEvent } from '../upstream-schemas.ts'
import { dedupeByKey, type NormalizeResult, type SkippedEntry } from './common.ts'

interface DatedEvent extends GameEvent {
  start: string
  end: string
}

export function normalizeWild(
  events: readonly GameEvent[],
  rates: Rates,
  names: SpeciesNames,
  now: Date,
): WildResult {
  const baseDenom = rates.tiers[rates.encounterDefaults.wild].denom
  const rows: Row[] = []
  const skipped: SkippedEntry[] = []
  const unparseableEvents: string[] = []
  const reportUnparseable = (event: GameEvent): void => {
    unparseableEvents.push(`${event.eventID} (${event.start} to ${event.end})`)
  }
  for (const event of findActiveEvents(events, now, reportUnparseable, WILD_LOOK_AHEAD_MS)) {
    const window = { start: event.start, end: event.end, local: isLocalTime(event.end) }
    for (const candidate of wildCandidates(event, rates, names, skipped)) {
      const odds = resolveTier(rates, {
        dex: candidate.dex,
        encounterType: 'wild',
        canBeShiny: candidate.canBeShiny,
        event: { eventID: event.eventID, eventType: event.eventType },
      })
      // The Wild tab is only for boosted spawns; everything at base odds is on the All Pokémon tab.
      if (odds.denom === null || odds.denom >= baseDenom) continue
      rows.push({ key: `wild:${event.eventID}:${candidate.name}`, dex: candidate.dex, name: candidate.name, source: event.name, ...odds, window })
    }
  }
  return { rows: dedupeByKey(rows), skipped, unparseableEvents }
}

export interface WildResult extends NormalizeResult {
  /** "eventID (start to end)" for each dated event whose start or end is not a valid time. */
  unparseableEvents: string[]
}

interface WildCandidate {
  dex: number
  name: string
  canBeShiny: boolean
}

/**
 * Community Day `shinies` always count. Spotlight Hour species and an eventOverride's bare dex list count only
 * when rates.json has an eventOverride for this event. Raid battle `shinies` are raid encounters, not wild spawns.
 */
function wildCandidates(event: GameEvent, rates: Rates, names: SpeciesNames, skipped: SkippedEntry[]): WildCandidate[] {
  const candidates: WildCandidate[] = []
  const addFromImage = (species: { name: string; image: string }, canBeShiny: boolean): void => {
    const dex = parseDex(species.image)
    if (dex === null) skipped.push({ tab: 'wild', name: species.name, image: species.image })
    else candidates.push({ dex, name: species.name, canBeShiny })
  }

  for (const species of event.extraData?.communityday?.shinies ?? []) addFromImage(species, true)

  const override = ownValue(rates.eventOverrides, event.eventID)
  if (override === undefined) return candidates
  for (const species of event.extraData?.spotlight?.list ?? []) {
    const dex = parseDex(species.image)
    // An image with no dex can't be matched to the override, so report it rather than drop it unseen.
    if (dex === null || override.dex.includes(dex)) addFromImage(species, species.canBeShiny)
  }
  for (const dex of override.dex) {
    const name = ownValue(names, String(dex))
    // index.ts fails the build before this point if an override names a dex missing from species-names.json.
    if (name !== undefined && !candidates.some((candidate) => candidate.dex === dex)) {
      candidates.push({ dex, name, canBeShiny: true })
    }
  }
  return candidates
}

/**
 * Local-time events (no offset) run at the same wall-clock time in every timezone, UTC-12 to UTC+14.
 * The build keeps any that are running somewhere; the browser filters exactly with the viewer's clock.
 */
const LOCAL_TIME_SLACK_MS = 14 * 60 * 60 * 1000

/**
 * Wild rows carry their event window and the browser hides them until it starts, so the build also keeps events
 * starting before the next build: the 4-hour schedule interval in deploy.yml plus 2 hours for a late or slow run.
 */
const WILD_LOOK_AHEAD_MS = 6 * 60 * 60 * 1000

/**
 * Events running at `now`, or starting within `lookAheadMs` after it. Null-dated or unparseable events are left
 * out (the latter also passed to `onUnparseable`).
 */
export function findActiveEvents(
  events: readonly GameEvent[],
  now: Date,
  onUnparseable: (event: GameEvent) => void = () => {},
  lookAheadMs = 0,
): DatedEvent[] {
  const nowMs = now.getTime()
  return events.filter((event): event is DatedEvent => {
    if (event.start === null || event.end === null) return false
    const slackMs = isLocalTime(event.end) ? LOCAL_TIME_SLACK_MS : 0
    // Wall-clock times are read as UTC so the result never depends on the build machine's timezone.
    const startMs = parseEventTime(event.start, 'utc')
    const endMs = parseEventTime(event.end, 'utc')
    if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
      onUnparseable(event)
      return false
    }
    return startMs - slackMs - lookAheadMs <= nowMs && nowMs <= endMs + slackMs
  })
}
