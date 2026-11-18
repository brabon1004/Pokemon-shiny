import { describe, expect, it } from 'vitest'
import { calculateShinyChance, parseDenomInput, parseEncountersInput } from './calculator.ts'

describe('parseDenomInput', () => {
  it('accepts odds of 1 or more, including decimals and surrounding spaces', () => {
    expect(parseDenomInput(' 64 ')).toEqual({ ok: true, value: 64 })
    expect(parseDenomInput('1')).toEqual({ ok: true, value: 1 })
    expect(parseDenomInput('25.5')).toEqual({ ok: true, value: 25.5 })
  })

  it('rejects empty, non-numeric, and below-1 odds with a message', () => {
    for (const input of ['', 'abc', '0', '0.5', '-3', 'Infinity']) {
      expect(parseDenomInput(input)).toEqual({ ok: false, message: 'Enter odds of 1 or more, like 64.' })
    }
  })
})

describe('parseEncountersInput', () => {
  it('accepts whole numbers from 0', () => {
    expect(parseEncountersInput('0')).toEqual({ ok: true, value: 0 })
    expect(parseEncountersInput('30')).toEqual({ ok: true, value: 30 })
  })

  it('rejects fractions, negatives, and text', () => {
    for (const input of ['', '2.5', '-1', 'ten', '1e400']) {
      expect(parseEncountersInput(input)).toEqual({
        ok: false,
        message: 'Enter a whole number of encounters, like 50.',
      })
    }
  })
})

describe('calculateShinyChance', () => {
  it('matches the mockup example: 1 in 20 over 30 encounters', () => {
    const result = calculateShinyChance(20, 30)
    expect(result.chance).toBeCloseTo(1 - 0.95 ** 30, 10)
    expect(result.milestones).toEqual([
      { target: 0.5, encounters: 14 },
      { target: 0.9, encounters: 45 },
      { target: 0.99, encounters: 90 },
    ])
  })

  it('gives 0 chance for 0 encounters and 1 encounter per milestone at 1 in 1', () => {
    expect(calculateShinyChance(64, 0).chance).toBe(0)
    expect(calculateShinyChance(1, 5).milestones.map((m) => m.encounters)).toEqual([1, 1, 1])
  })
})
