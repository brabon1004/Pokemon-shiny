import type { Row } from '../../../src/shared/contract.ts'
import { isLocalTime, parseEventTime } from '../../../src/shared/event-time.ts'
import type { Rates } from '../../../src/shared/rates.ts'
import { parseDex } from '../dex.ts'
import type { SpeciesNames } from '../names.ts'
import { ownValue, resolveTier } from '../resolve-tier.ts'
import { isShinyAvailable } from '../shiny-keys.ts'
import type { WildEncounter } from '../parse-wild-encounters.ts'
import type { GameEvent } from '../upstream-schemas.ts'
import { dedupeByKey, type NormalizeResult, type SkippedEntry } from './common.ts'

interface DatedEvent extends GameEvent {
  start: string
  end: string
}

/** What the build fetched beyond events.json, so normalizeWild stays pure. */
export interface WildSources {
  /** Wild encounters read from each event's LeekDuck page, keyed by eventID. */
  encountersByEvent: ReadonlyMap<string, readonly WildEncounter[]>
  /** `aa_fn` keys of released shinies; see shiny-keys.ts. */
  releasedKeys: ReadonlySet<string>
}

export function normalizeWild(
  events: readonly GameEvent[],
  rates: Rates,
  names: SpeciesNames,
  now: Date,
  sources: WildSources,
): WildResult {
  const rows: Row[] = []
  const skipped: SkippedEntry[] = []
  const unparseableEvents: string[] = []
  const reportUnparseable = (event: GameEvent): void => {
    unparseableEvents.push(`${event.eventID} (${event.start} to ${event.end})`)
  }
  for (const event of findWildEvents(events, now, reportUnparseable)) {
    const window = { start: event.start, end: event.end, local: isLocalTime(event.end) }
    for (const candidate of wildCandidates(event, rates, names, sources, skipped)) {
      const eventContext = candidate.isFeatured
        ? { event: { eventID: event.eventID, eventType: event.eventType } }
        : // Not featured: the event's overrides still apply, but its event-type default (Community Day odds) doesn't.
          { activeEventIDs: [event.eventID] }
      const odds = resolveTier(rates, { dex: candidate.dex, encounterType: 'wild', canBeShiny: candidate.canBeShiny, ...eventContext })
      rows.push({ key: `wild:${event.eventID}:${candidate.name}`, dex: candidate.dex, name: candidate.name, source: event.name, ...odds, window })
    }
  }
  return { rows: dedupeByKey(rows), skipped, unparseableEvents }
}

/** A season lists the regular wild pool for months, not an event boost, so its spawns stay off the Wild tab. */
const NON_EVENT_TYPES = new Set(['season'])

/** Events whose spawns belong on the Wild tab: running now or starting before the next build, excluding seasons. */
export function findWildEvents(
  events: readonly GameEvent[],
  now: Date,
  onUnparseable: (event: GameEvent) => void = () => {},
): DatedEvent[] {
  return findActiveEvents(events, now, onUnparseable, WILD_LOOK_AHEAD_MS).filter((event) => !NON_EVENT_TYPES.has(event.eventType))
}

export interface WildResult extends NormalizeResult {
  /** "eventID (start to end)" for each dated event whose start or end is not a valid time. */
  unparseableEvents: string[]
}

interface WildCandidate {
  dex: number
  name: string
  canBeShiny: boolean
  /** False for Community Day spawns that are not among its featured shinies. */
  isFeatured: boolean
}

/**
 * Wild spawns for one event: Community Day `shinies` and `spawns`, Spotlight Hour species, the species on the event's LeekDuck
 * page, and any bare dex numbers its eventOverride lists. Raid battle `shinies` are raid encounters, not wild spawns.
 */
function wildCandidates(
  event: GameEvent,
  rates: Rates,
  names: SpeciesNames,
  sources: WildSources,
  skipped: SkippedEntry[],
): WildCandidate[] {
  const candidates: WildCandidate[] = []
  const addFromImage = (species: { name: string; image: string }, upstreamCanBeShiny: boolean, isFeatured = true): void => {
    const dex = parseDex(species.image)
    if (dex === null) {
      skipped.push({ tab: 'wild', name: species.name, image: species.image })
      return
    }
    const canBeShiny = isShinyAvailable(upstreamCanBeShiny, species.image, sources.releasedKeys)
    candidates.push({ dex, name: species.name, canBeShiny, isFeatured })
  }

  const communityDay = event.extraData?.communityday
  for (const species of communityDay?.shinies ?? []) addFromImage(species, true)
  // Featured species come first, so dedupeByKey keeps their row when `spawns` repeats them.
  for (const species of communityDay?.spawns ?? []) addFromImage(species, false, false)
  for (const species of spotlightSpecies(event)) addFromImage(species, species.canBeShiny)
  for (const encounter of sources.encountersByEvent.get(event.eventID) ?? []) addFromImage(encounter, encounter.canBeShiny)

  for (const dex of ownValue(rates.eventOverrides, event.eventID)?.dex ?? []) {
    const name = ownValue(names, String(dex))
    // index.ts fails the build before this point if an override names a dex missing from species-names.json.
    if (name !== undefined && !candidates.some((candidate) => candidate.dex === dex)) {
      candidates.push({ dex, name, canBeShiny: true, isFeatured: true })
    }
  }
  return candidates
}

type SpotlightEntry = { name: string; image: string; canBeShiny: boolean }

/** `spotlight.list` when present; older entries only carry the single featured species on `spotlight` itself. */
function spotlightSpecies(event: GameEvent): SpotlightEntry[] {
  const spotlight = event.extraData?.spotlight
  if (spotlight === undefined) return []
  if (spotlight.list !== undefined && spotlight.list.length > 0) return spotlight.list
  const { name, image, canBeShiny } = spotlight
  return name === undefined || image === undefined ? [] : [{ name, image, canBeShiny: canBeShiny ?? false }]
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

/** Community Day and Spotlight Hour species come from events.json itself, so their pages are not read. */
const TYPES_WITH_SPAWNS_IN_JSON = new Set(['community-day', 'pokemon-spotlight-hour'])

/** Wild-tab events whose LeekDuck page has to be read to learn their spawns (`extraData.generic.hasSpawns`). */
export function findEventsWithSpawnPages(events: readonly GameEvent[], now: Date): DatedEvent[] {
  return findWildEvents(events, now).filter(
    (event) => event.extraData?.generic?.hasSpawns === true && !TYPES_WITH_SPAWNS_IN_JSON.has(event.eventType),
  )
}
