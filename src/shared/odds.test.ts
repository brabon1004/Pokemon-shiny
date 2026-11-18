import { describe, expect, it } from 'vitest'
import { chanceOfAtLeastOne, encountersForChance } from './odds.ts'

describe('chanceOfAtLeastOne', () => {
  it('returns 1 - (1 - 1/denom)^n for ordinary odds', () => {
    expect(chanceOfAtLeastOne(2, 2)).toBeCloseTo(0.75, 12)
    expect(chanceOfAtLeastOne(4, 2)).toBeCloseTo(7 / 16, 12)
  })

  it('matches known values at the app tier rates', () => {
    expect(chanceOfAtLeastOne(512, 512)).toBeCloseTo(0.6325, 4)
    expect(chanceOfAtLeastOne(20, 30)).toBeCloseTo(0.7854, 4)
    expect(encountersForChance(64, 0.5)).toBe(45)
  })

  it('keeps precision when the per-encounter chance is tiny', () => {
    // Naive 1 - (1 - 1e-12) ** 1 cancels to 9.9998e-13.
    expect(chanceOfAtLeastOne(1e12, 1)).toBeCloseTo(1e-12, 24)
  })
})

describe('chanceOfAtLeastOne at the boundaries', () => {
  it('is certain after one encounter when denom is 1 or less', () => {
    expect(chanceOfAtLeastOne(1, 1)).toBe(1)
    expect(chanceOfAtLeastOne(0.5, 3)).toBe(1)
  })

  it('is 0 with zero encounters, even at denom 1', () => {
    expect(chanceOfAtLeastOne(512, 0)).toBe(0)
    expect(chanceOfAtLeastOne(1, 0)).toBe(0)
  })

  it('approaches 1 for a huge number of encounters', () => {
    expect(chanceOfAtLeastOne(512, 1e9)).toBe(1)
  })
})

describe('chanceOfAtLeastOne input validation', () => {
  it.each([0, -5, Number.NaN, Number.POSITIVE_INFINITY])('rejects denom %s', (denom) => {
    expect(() => chanceOfAtLeastOne(denom, 10)).toThrow(RangeError)
    expect(() => chanceOfAtLeastOne(denom, 10)).toThrow(/denom must be a finite number greater than 0/)
  })

  it.each([-1, 2.5, Number.NaN, Number.POSITIVE_INFINITY])('rejects encounter count %s', (n) => {
    expect(() => chanceOfAtLeastOne(512, n)).toThrow(RangeError)
    expect(() => chanceOfAtLeastOne(512, n)).toThrow(/encounter count must be a whole number of 0 or more/)
  })
})

describe('encountersForChance', () => {
  it('returns the smallest encounter count that reaches the target', () => {
    // ln(0.5) / ln(511/512) = 354.55, so 355 encounters.
    expect(encountersForChance(512, 0.5)).toBe(355)
    expect(chanceOfAtLeastOne(512, 355)).toBeGreaterThanOrEqual(0.5)
    expect(chanceOfAtLeastOne(512, 354)).toBeLessThan(0.5)
  })
})

describe('encountersForChance at exact boundaries', () => {
  it('returns the smallest count reaching a target taken from an exact encounter count', () => {
    for (const denom of [2, 10, 20, 25, 64, 128, 512]) {
      for (const k of [1, 2, 3, 7, 50, 355, 1000]) {
        const target = chanceOfAtLeastOne(denom, k)
        // Past ~1 - 1e-9, neighbouring counts round to the same double, so "smallest" stops being meaningful.
        if (target > 1 - 1e-9) continue
        const encounters = encountersForChance(denom, target)
        const label = `denom ${denom}, k ${k}`
        expect(encounters, label).toBeLessThanOrEqual(k)
        expect(chanceOfAtLeastOne(denom, encounters), label).toBeGreaterThanOrEqual(target)
        expect(chanceOfAtLeastOne(denom, encounters - 1), label).toBeLessThan(target)
      }
    }
  })

  it('returns exactly k while the chance after k is distinguishable from k-1', () => {
    expect(encountersForChance(10, chanceOfAtLeastOne(10, 50))).toBe(50)
    expect(encountersForChance(512, chanceOfAtLeastOne(512, 1000))).toBe(1000)
  })
})

describe('encountersForChance edge cases', () => {
  it('needs 0 encounters for a 0 target', () => {
    expect(encountersForChance(512, 0)).toBe(0)
    expect(encountersForChance(1, 0)).toBe(0)
  })

  it('can never guarantee a shiny at real odds, so target 1 is Infinity', () => {
    expect(encountersForChance(512, 1)).toBe(Number.POSITIVE_INFINITY)
  })

  it('needs 1 encounter for any positive target when denom is 1 or less', () => {
    expect(encountersForChance(1, 1)).toBe(1)
    expect(encountersForChance(0.5, 0.3)).toBe(1)
  })

  it.each([-0.1, 1.5, Number.NaN])('rejects target %s', (target) => {
    expect(() => encountersForChance(512, target)).toThrow(RangeError)
    expect(() => encountersForChance(512, target)).toThrow(/target chance must be between 0 and 1/)
  })

  it.each([0, -64, Number.NaN, Number.POSITIVE_INFINITY])('rejects denom %s', (denom) => {
    expect(() => encountersForChance(denom, 0.5)).toThrow(RangeError)
  })
})
