import { describe, expect, it } from 'vitest'
import {
  formatChance,
  formatCount,
  formatDex,
  formatEncounters,
  formatOdds,
  formatPerEncounterPercent,
} from './format.ts'

describe('formatOdds', () => {
  it('writes the denominator as "1 in N" with thousands separators', () => {
    expect(formatOdds(64)).toBe('1 in 64')
    expect(formatOdds(4096)).toBe('1 in 4,096')
  })
})

describe('formatPerEncounterPercent', () => {
  it('uses one decimal at 1% or more and two below it', () => {
    expect(formatPerEncounterPercent(20)).toBe('5.0%')
    expect(formatPerEncounterPercent(64)).toBe('1.6%')
    expect(formatPerEncounterPercent(512)).toBe('0.20%')
  })
})

describe('formatChance', () => {
  it('rounds to one decimal', () => {
    expect(formatChance(0.78538)).toBe('78.5%')
    expect(formatChance(0)).toBe('0.0%')
    expect(formatChance(1)).toBe('100.0%')
  })

  it('never rounds a near-certain chance up to 100%', () => {
    expect(formatChance(0.99996)).toBe('>99.9%')
  })

  it('never rounds a tiny positive chance down to 0%', () => {
    expect(formatChance(0.0001)).toBe('<0.1%')
  })
})

describe('formatEncounters', () => {
  it('pluralizes and adds separators', () => {
    expect(formatEncounters(1)).toBe('1 encounter')
    expect(formatEncounters(2302)).toBe('2,302 encounters')
  })

  it('describes an unreachable count instead of printing Infinity', () => {
    expect(formatEncounters(Number.POSITIVE_INFINITY)).toBe('never guaranteed')
  })
})

describe('formatDex', () => {
  it('pads to three digits with a leading #', () => {
    expect(formatDex(7)).toBe('#007')
    expect(formatDex(1025)).toBe('#1025')
  })
})

describe('formatCount', () => {
  it('groups thousands with commas', () => {
    expect(formatCount(0)).toBe('0')
    expect(formatCount(1234)).toBe('1,234')
  })
})
