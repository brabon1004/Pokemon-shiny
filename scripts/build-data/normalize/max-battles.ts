// Max Battle bosses for the Dynamax tab: the hand-kept rotation in data/rates.json (`maxBattles`), plus the boss
// named by any Max Monday or Max Battle Day event running now.
import { MAX_BATTLE_LIST_KEY_PREFIX, type Row } from '../../../src/shared/contract.ts'
import { isLocalTime } from '../../../src/shared/event-time.ts'
import type { MaxBattleBoss, MaxForm, Rates } from '../../../src/shared/rates.ts'
import type { SpeciesNames } from '../names.ts'
import { resolveTier, type TierQuery } from '../resolve-tier.ts'
import type { GameEvent } from '../upstream-schemas.ts'
import { dedupeByKey } from './common.ts'
import { findActiveEvents, WINDOWED_ROW_LOOK_AHEAD_MS } from './wild.ts'

export interface MaxBattleSources {
  /** `aa_fn` keys of released shinies; see shiny-keys.ts. */
  releasedKeys: ReadonlySet<string>
  /** Events running now whose eventOverrides may apply to the hand-kept bosses; first listed wins. */
  activeEventIDs: readonly string[]
}

export interface MaxBattleResult {
  rows: Row[]
  /** Problems that left bosses off the tab. */
  warnings: string[]
}

const FORM_LABELS: Record<MaxForm, string> = { dynamax: 'Dynamax', gigantamax: 'Gigantamax' }

/** ScrapedDuck event types that feature one Max Battle boss, named in the event name. */
const MAX_BATTLE_EVENT_TYPES = new Set(['max-mondays', 'max-battles'])

/**
 * "Dynamax Espurr during Max Monday", "Gigantamax Lapras Max Battle Day", "G-Max Pikachu Max Battles": the form, then
 * the species. Anything else ("Max Battle Day", "Eternamax Eternatus Returns") is not read, rather than guessed at.
 */
const BOSS_IN_EVENT_NAME = /^(Dynamax|Gigantamax|G-Max) (.+?)(?: (?:during Max Mondays?|Max Battle Day|Max Battles?))?$/i

/** Real event names are under 60 characters. Longer ones are skipped, which also bounds the matching work. */
export const MAX_EVENT_NAME_LENGTH = 200

export function normalizeMaxBattles(
  events: readonly GameEvent[],
  rates: Rates,
  names: SpeciesNames,
  now: Date,
  sources: MaxBattleSources,
): MaxBattleResult {
  const rows: Row[] = []
  const warnings: string[] = []
  const { updated, until, bosses } = rates.maxBattles
  // "YYYY-MM-DD" strings order like dates. Compare against yesterday in UTC so the list survives until "until" has
  // ended in every timezone (down to UTC−12); the rows' local window hides them for each viewer at the exact time.
  const yesterdayUtc = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  if (until !== null && until < yesterdayUtc) {
    warnings.push(`maxBattles list expired on ${until}; update the bosses and "until" in data/rates.json`)
  } else {
    const tierContext = { activeEventIDs: sources.activeEventIDs }
    // The UI sorts by best odds and keeps this order for ties: star tier, then name.
    const byStarsThenName = bosses.toSorted((a, b) => a.stars - b.stars || a.name.localeCompare(b.name))
    // With an end date, the browser hides the list after it even if no build runs to drop it.
    const window = until === null ? undefined : listWindow(updated, until)
    for (const boss of byStarsThenName) {
      const row = maxRow(boss, MAX_BATTLE_LIST_KEY_PREFIX, `${boss.stars}★ Max Battle`, rates, sources, tierContext)
      rows.push(window === undefined ? row : { ...row, window })
    }
  }
  const speciesByName = new Map(Object.entries(names).map(([dex, name]) => [name.toLowerCase(), { dex: Number(dex), name }]))
  const unreadEvents: string[] = []
  const overlongEventIDs: string[] = []
  // Unparseable dates are already reported once by normalizeWild, which sees every event.
  for (const event of findActiveEvents(events, now, undefined, WINDOWED_ROW_LOOK_AHEAD_MS)) {
    if (!MAX_BATTLE_EVENT_TYPES.has(event.eventType)) continue
    if (event.name.length > MAX_EVENT_NAME_LENGTH) {
      overlongEventIDs.push(event.eventID)
      continue
    }
    const boss = parseBossFromEventName(event.name, speciesByName)
    if (boss === null) {
      unreadEvents.push(`${event.name} (${event.eventID})`)
      continue
    }
    const window = { start: event.start, end: event.end, local: isLocalTime(event.end) }
    const tierContext = { event: { eventID: event.eventID, eventType: event.eventType } }
    rows.push({ ...maxRow(boss, `dynamax:${event.eventID}:`, event.name, rates, sources, tierContext), window })
  }
  for (const eventID of overlongEventIDs) {
    warnings.push(
      `Max Battle event ${eventID} has a name over ${MAX_EVENT_NAME_LENGTH} characters; not read (not listed on the Dynamax tab)`,
    )
  }
  if (unreadEvents.length > 0) {
    warnings.push(
      `Max Battle events with no boss the build could read from the name (not listed on the Dynamax tab): ${unreadEvents.join('; ')}`,
    )
  }
  return { rows: dedupeByKey(rows), warnings }
}

/** Local midnight at the start of `updated` through local midnight after `until`, both "YYYY-MM-DD". */
function listWindow(updated: string, until: string): NonNullable<Row['window']> {
  const dayAfterUntil = new Date(`${until}T00:00:00Z`)
  dayAfterUntil.setUTCDate(dayAfterUntil.getUTCDate() + 1)
  return { start: `${updated}T00:00:00.000`, end: `${dayAfterUntil.toISOString().slice(0, 10)}T00:00:00.000`, local: true }
}

type Boss = Pick<MaxBattleBoss, 'dex' | 'name' | 'form'>

/** The boss an event name announces, or null unless the name follows a known pattern and names a known species exactly. */
function parseBossFromEventName(
  eventName: string,
  speciesByName: ReadonlyMap<string, { dex: number; name: string }>,
): Boss | null {
  // One space between words lets the pattern use literal spaces: no overlapping \s+ runs to backtrack across.
  const match = BOSS_IN_EVENT_NAME.exec(eventName.trim().replace(/\s+/g, ' '))
  if (match === null) return null
  const [, formWord = '', speciesText = ''] = match
  const species = speciesByName.get(speciesText.toLowerCase())
  if (species === undefined) return null
  return { ...species, form: formWord.toLowerCase() === 'dynamax' ? 'dynamax' : 'gigantamax' }
}

/** `keyPrefix` is MAX_BATTLE_LIST_KEY_PREFIX for the hand-kept rotation, or "dynamax:<eventID>:". */
function maxRow(
  boss: Boss,
  keyPrefix: string,
  source: string,
  rates: Rates,
  sources: MaxBattleSources,
  tierContext: Pick<TierQuery, 'event' | 'activeEventIDs'>,
): Row {
  const name = `${FORM_LABELS[boss.form]} ${boss.name}`
  const odds = resolveTier(rates, {
    dex: boss.dex,
    encounterType: `max:${boss.form}`,
    canBeShiny: isMaxBossShiny(boss.dex, boss.form, sources.releasedKeys),
    ...tierContext,
  })
  return { key: `${keyPrefix}${name}`, dex: boss.dex, name, source, ...odds }
}

/**
 * Assumption: a Dynamax boss is the regular form, so its shiny is out once the base form's shiny (`pm<dex>`) is on
 * LeekDuck's list. Gigantamax bosses look different and have their own entries (`pm<dex>.fGIGANTAMAX`), so only that
 * entry counts. ScrapedDuck has no Max Battle feed with a shiny flag to check against.
 */
function isMaxBossShiny(dex: number, form: MaxForm, releasedKeys: ReadonlySet<string>): boolean {
  return releasedKeys.has(form === 'gigantamax' ? `pm${dex}.fGIGANTAMAX` : `pm${dex}`)
}
