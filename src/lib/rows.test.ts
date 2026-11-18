import { describe, expect, it } from 'vitest'
import type { Row } from '../shared/contract.ts'
import { filterByName, isWindowActive, selectActiveWild, sortByBestOdds } from './rows.ts'

function shinyRow(name: string, denom: number): Row {
  return { key: name, dex: 1, name, source: 'test', shiny: true, denom, tier: 'base' }
}
function noShinyRow(name: string): Row {
  return { key: name, dex: 1, name, source: 'test', shiny: false, denom: null, tier: null }
}

describe('sortByBestOdds', () => {
  it('puts the smallest denominator first and shiny-unavailable rows last', () => {
    const sorted = sortByBestOdds([shinyRow('a', 512), noShinyRow('x'), shinyRow('b', 20), shinyRow('c', 64)])
    expect(sorted.map((row) => row.name)).toEqual(['b', 'c', 'a', 'x'])
  })

  it('keeps the original order for ties and does not mutate the input', () => {
    const rows = [shinyRow('first', 64), shinyRow('second', 64), noShinyRow('n1'), noShinyRow('n2')]
    const sorted = sortByBestOdds(rows)
    expect(sorted.map((row) => row.name)).toEqual(['first', 'second', 'n1', 'n2'])
    expect(sorted).not.toBe(rows)
  })
})

describe('filterByName', () => {
  const rows = [shinyRow('Flabébé', 512), shinyRow('Alolan Meowth', 512), shinyRow('Pikachu', 512)]

  it('matches case-insensitively anywhere in the name', () => {
    expect(filterByName(rows, 'MEOW').map((row) => row.name)).toEqual(['Alolan Meowth'])
  })

  it('ignores accents on either side', () => {
    expect(filterByName(rows, 'flabebe').map((row) => row.name)).toEqual(['Flabébé'])
    expect(filterByName([shinyRow('Pikachu', 512)], 'píka')).toHaveLength(1)
  })

  it('returns every row for an empty or whitespace-only query', () => {
    expect(filterByName(rows, '   ')).toHaveLength(3)
  })

  it('returns nothing when no name matches', () => {
    expect(filterByName(rows, 'mewtwo')).toEqual([])
  })
})

describe('isWindowActive', () => {
  const now = new Date('2026-11-18T12:00:00') // viewer-local noon

  it('reads local windows in the viewer timezone', () => {
    expect(isWindowActive({ start: '2026-11-18T11:00:00', end: '2026-11-18T13:00:00', local: true }, now)).toBe(true)
    expect(isWindowActive({ start: '2026-11-18T12:30:00', end: '2026-11-18T13:00:00', local: true }, now)).toBe(false)
  })

  it('reads non-local windows as UTC', () => {
    const utcNow = new Date('2026-11-18T12:00:00Z')
    expect(isWindowActive({ start: '2026-11-18T11:00:00Z', end: '2026-11-18T13:00:00Z', local: false }, utcNow)).toBe(true)
    // A UTC window given without its trailing Z is still read as UTC.
    expect(isWindowActive({ start: '2026-11-18T11:00:00', end: '2026-11-18T13:00:00', local: false }, utcNow)).toBe(true)
    expect(isWindowActive({ start: '2026-11-18T12:00:01Z', end: '2026-11-18T13:00:00Z', local: false }, utcNow)).toBe(false)
  })

  it('includes the start instant and excludes the end instant', () => {
    expect(isWindowActive({ start: '2026-11-18T12:00:00', end: '2026-11-18T13:00:00', local: true }, now)).toBe(true)
    expect(isWindowActive({ start: '2026-11-18T10:00:00', end: '2026-11-18T12:00:00', local: true }, now)).toBe(false)
  })

  it('treats unparseable times as inactive', () => {
    expect(isWindowActive({ start: 'soon', end: '2026-11-18T13:00:00', local: true }, now)).toBe(false)
  })
})

describe('selectActiveWild', () => {
  it('keeps rows whose window covers now and rows with no window', () => {
    const now = new Date('2026-11-18T12:00:00')
    const live = { ...shinyRow('live', 25), window: { start: '2026-11-18T00:00:00', end: '2026-11-19T00:00:00', local: true } }
    const later = { ...shinyRow('later', 25), window: { start: '2026-11-22T00:00:00', end: '2026-11-23T00:00:00', local: true } }
    const unbounded = shinyRow('unbounded', 128)
    expect(selectActiveWild([live, later, unbounded], now).map((row) => row.name)).toEqual(['live', 'unbounded'])
  })
})
