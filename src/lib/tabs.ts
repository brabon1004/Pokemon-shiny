import type { Combined, Row } from '../shared/contract.ts'
import { dropListedBossesWithEvents, selectLiveRows } from './rows.ts'

export const TAB_IDS = ['wild', 'raids', 'dynamax', 'eggs', 'research', 'all'] as const
export type TabId = (typeof TAB_IDS)[number]

export const TAB_PANEL_ID = 'encounter-panel'
export const tabElementId = (tab: TabId): string => `tab-${tab}`

interface TabDetails {
  label: string
  /** Leading part of `label` shown alone in the phone tab bar; the rest stays in the accessible name. */
  compactLabel?: string
  title: string
  /** A caveat shown under the title. */
  note?: string
  emptyMessage: string
}

export const TAB_DETAILS: Record<TabId, TabDetails> = {
  wild: { label: 'Wild', title: 'Event wild spawns', emptyMessage: 'No event spawns right now.' },
  raids: { label: 'Raids', title: 'Raid bosses', emptyMessage: 'No raid bosses are listed right now.' },
  dynamax: {
    label: 'Dynamax',
    title: 'Max Battles',
    note: 'Shiny rates for Max Battles are unverified estimates.',
    emptyMessage: 'No Max Battle bosses listed right now.',
  },
  eggs: { label: 'Eggs', title: 'Egg hatches', emptyMessage: 'No egg hatches are listed right now.' },
  research: { label: 'Research', title: 'Research rewards', emptyMessage: 'No research rewards are listed right now.' },
  all: { label: 'All Pokémon', compactLabel: 'All', title: 'All shiny Pokémon', emptyMessage: 'No shiny Pokémon are listed yet.' },
}

/**
 * Rows each tab lists before search. Wild and Dynamax only list rows whose event window, if any, covers `now`, and a
 * live Max Battle event replaces the same boss from the hand-kept list.
 */
export function selectRowsByTab(data: Combined, now: Date): Record<TabId, Row[]> {
  return {
    wild: selectLiveRows(data.wild, now),
    raids: data.raids,
    dynamax: dropListedBossesWithEvents(selectLiveRows(data.dynamax, now)),
    eggs: data.eggs,
    research: data.research,
    all: data.all,
  }
}
