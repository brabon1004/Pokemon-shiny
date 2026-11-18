import { describe, expect, it } from 'vitest'
import type { Row, Tier } from '../shared/contract.ts'
import { groupWildByEvent } from './wild-groups.ts'

const UTC_END = { start: '2026-11-01T00:00:00.000Z', local: false } as const

function wildRow(event: string, end: string, name: string, denom: number | null, tier: Tier | null = 'base'): Row {
  const shiny = denom !== null
  return {
    key: `wild:${event}:${name}`,
    dex: 1,
    name,
    source: event,
    shiny,
    denom,
    tier: shiny ? tier : null,
    window: { ...UTC_END, end },
  }
}

const names = (groups: ReturnType<typeof groupWildByEvent>) =>
  groups.map((group) => [group.event, group.rows.map((row) => row.name)])

describe('groupWildByEvent', () => {
  it('puts each event in one group, rows ordered by best odds then name', () => {
    const groups = groupWildByEvent([
      wildRow('Trails', '2026-11-23T20:00:00.000Z', 'Squirtle', 512),
      wildRow('Trails', '2026-11-23T20:00:00.000Z', 'Gastly', null),
      wildRow('Trails', '2026-11-23T20:00:00.000Z', 'Bulbasaur', 512),
      wildRow('Trails', '2026-11-23T20:00:00.000Z', 'Pikachu', 64, 'boosted'),
    ])
    expect(names(groups)).toEqual([['Trails', ['Pikachu', 'Bulbasaur', 'Squirtle', 'Gastly']]])
    expect(groups[0]?.window?.end).toBe('2026-11-23T20:00:00.000Z')
  })

  it('lists events with a boosted row first, then the rest by soonest end; an event with no window goes last', () => {
    const noWindow: Row = { ...wildRow('Open-ended', 'x', 'Ditto', 512), window: undefined }
    const groups = groupWildByEvent([
      noWindow,
      wildRow('Late base', '2026-12-01T00:00:00.000Z', 'Eevee', 512),
      wildRow('Early base', '2026-11-20T00:00:00.000Z', 'Zubat', 512),
      wildRow('Late boosted', '2026-12-05T00:00:00.000Z', 'Oddish', 512),
      wildRow('Late boosted', '2026-12-05T00:00:00.000Z', 'Pikachu', 64, 'event'),
      wildRow('Early boosted', '2026-11-25T00:00:00.000Z', 'Rattata', 128, 'boosted'),
    ])
    expect(groups.map((group) => group.event)).toEqual(['Early boosted', 'Late boosted', 'Early base', 'Late base', 'Open-ended'])
  })

  it('returns no groups for no rows', () => {
    expect(groupWildByEvent([])).toEqual([])
  })
})

