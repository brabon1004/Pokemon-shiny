// Pure assembly of combined.json from already-validated upstream data. index.ts does the I/O.
import type { Combined } from '../../src/shared/contract.ts'
import type { Rates } from '../../src/shared/rates.ts'
import type { SpeciesNames } from './names.ts'
import type { SkippedEntry } from './normalize/common.ts'
import { normalizeEggs } from './normalize/eggs.ts'
import { normalizeMaxBattles } from './normalize/max-battles.ts'
import { normalizeRaids } from './normalize/raids.ts'
import { normalizeResearch } from './normalize/research.ts'
import { normalizeShinyList } from './normalize/shiny-list.ts'
import { findActiveEvents, normalizeWild } from './normalize/wild.ts'
import type { WildEncounter } from './parse-wild-encounters.ts'
import { releasedShinyKeys, unflaggedShinyWarning } from './shiny-keys.ts'
import type { EggHatch, GameEvent, RaidBoss, ResearchTask, ShinyListEntry } from './upstream-schemas.ts'

export interface BuildInput {
  rates: Rates
  names: SpeciesNames
  raids: readonly RaidBoss[]
  eggs: readonly EggHatch[]
  research: readonly ResearchTask[]
  events: readonly GameEvent[]
  shinyList: readonly ShinyListEntry[]
  /** Wild encounters read from LeekDuck event pages, keyed by eventID (see event-pages.ts). */
  encountersByEvent: ReadonlyMap<string, readonly WildEncounter[]>
  now: Date
}

/** Fewer rows than this means an upstream feed is broken, so the build fails and the last deploy stays live. */
export interface RowMinimums {
  raids: number
  eggs: number
  all: number
}
export const LIVE_ROW_MINIMUMS: RowMinimums = { raids: 1, eggs: 1, all: 500 }

export interface BuildOutput {
  combined: Combined
  skipped: SkippedEntry[]
  /** Problems that did not stop the build but mean some rows may be missing or rated by a fallback. */
  warnings: string[]
}

export function buildCombined(input: BuildInput, minimums: RowMinimums = LIVE_ROW_MINIMUMS): BuildOutput {
  const { rates, names, now } = input
  assertRatesNameKnownSpecies(rates, names)
  const activeEventIDs = findActiveEvents(input.events, now).map((event) => event.eventID)
  const releasedKeys = releasedShinyKeys(input.shinyList, now)
  const wild = normalizeWild(input.events, rates, names, now, { encountersByEvent: input.encountersByEvent, releasedKeys })
  const raids = normalizeRaids(input.raids, rates, activeEventIDs, releasedKeys)
  const maxBattles = normalizeMaxBattles(input.events, rates, names, now, { releasedKeys, activeEventIDs })
  const eggs = normalizeEggs(input.eggs, rates, releasedKeys)
  const research = normalizeResearch(input.research, rates, releasedKeys)
  const all = normalizeShinyList(input.shinyList, rates, names, now)

  const combined: Combined = {
    schemaVersion: 1,
    generatedAt: now.toISOString(),
    ratesUpdated: rates.updated,
    tiers: rates.tiers,
    wild: wild.rows,
    raids: raids.rows,
    dynamax: maxBattles.rows,
    eggs: eggs.rows,
    research: research.rows,
    all: all.rows,
  }
  assertRowMinimums(combined, minimums)
  const warnings = [
    unflaggedShinyWarning('ScrapedDuck raids', 'bosses', input.raids.map((boss) => boss.canBeShiny)),
    unflaggedShinyWarning('ScrapedDuck eggs', 'hatches', input.eggs.map((hatch) => hatch.canBeShiny)),
    unflaggedShinyWarning(
      'ScrapedDuck research',
      'rewards',
      input.research.flatMap((task) => task.rewards.map((reward) => reward.canBeShiny)),
    ),
  ].filter((warning) => warning !== null)
  warnings.push(...maxBattles.warnings)
  if (raids.unmappedTiers.length > 0) {
    warnings.push(`Unmapped raid tiers (using raid:default): ${raids.unmappedTiers.join(', ')}`)
  }
  if (wild.unparseableEvents.length > 0) {
    const count = wild.unparseableEvents.length
    warnings.push(`Ignored ${count} event${count === 1 ? '' : 's'} with unparseable dates: ${wild.unparseableEvents.join('; ')}`)
  }
  return { combined, skipped: [wild, raids, eggs, research, all].flatMap((result) => result.skipped), warnings }
}

/** A typo in a hand-edited override or Max Battle boss would otherwise silently match nothing or show the wrong Pokémon. */
function assertRatesNameKnownSpecies(rates: Rates, names: SpeciesNames): void {
  const problems: string[] = []
  const unknownSpeciesKeys = Object.keys(rates.speciesOverrides).filter((dex) => names[dex] === undefined)
  if (unknownSpeciesKeys.length > 0) problems.push(`speciesOverrides ${unknownSpeciesKeys.join(', ')}`)
  for (const [eventID, override] of Object.entries(rates.eventOverrides)) {
    const unknownDex = override.dex.filter((dex) => names[String(dex)] === undefined)
    if (unknownDex.length > 0) problems.push(`eventOverrides.${eventID} ${unknownDex.join(', ')}`)
  }
  const unknownBossDex = rates.maxBattles.bosses.filter((boss) => names[String(boss.dex)] === undefined).map((boss) => boss.dex)
  if (unknownBossDex.length > 0) problems.push(`maxBattles.bosses ${unknownBossDex.join(', ')}`)
  if (problems.length > 0) {
    throw new Error(`data/rates.json references dex numbers not in data/species-names.json: ${problems.join(', ')}`)
  }
  // The row shows the hand-typed name but the sprite and shiny check follow the dex, so the two must agree.
  for (const boss of rates.maxBattles.bosses) {
    const speciesName = names[String(boss.dex)]
    if (speciesName !== undefined && speciesName.toLowerCase() !== boss.name.toLowerCase()) {
      throw new Error(
        `data/rates.json maxBattles lists "${boss.name}" as dex ${boss.dex}, but dex ${boss.dex} is ${speciesName} in ` +
          'data/species-names.json. Fix the name or the dex.',
      )
    }
  }
}

function assertRowMinimums(combined: Combined, minimums: RowMinimums): void {
  const tabs: ReadonlyArray<keyof RowMinimums> = ['raids', 'eggs', 'all']
  const shortTabs = tabs
    .filter((tab) => combined[tab].length < minimums[tab])
    .map((tab) => `${tab} has ${combined[tab].length} rows (minimum ${minimums[tab]})`)
  if (shortTabs.length > 0) throw new Error(`sanity check failed: ${shortTabs.join('; ')}`)
}
