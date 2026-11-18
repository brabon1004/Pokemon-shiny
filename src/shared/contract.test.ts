import { describe, expect, it } from 'vitest'
import sample from '../fixtures/combined.sample.json' with { type: 'json' }
import { combinedSchema, rowSchema } from './contract.ts'

const shinyRow = {
  key: 'raid:5-Star Raids:Kyogre',
  dex: 382,
  name: 'Kyogre',
  source: '5-star raid',
  shiny: true,
  denom: 20,
  tier: 'legendary',
}

describe('combinedSchema', () => {
  it('accepts the sample fixture', () => {
    const parsed = combinedSchema.parse(sample)
    expect(parsed.schemaVersion).toBe(1)
    expect(parsed.all.length).toBeGreaterThanOrEqual(10)
    expect(parsed.wild.every((row) => row.window !== undefined)).toBe(true)
    expect([...parsed.raids, ...parsed.eggs, ...parsed.research].some((row) => !row.shiny)).toBe(true)
  })

  it('rejects an unknown schemaVersion', () => {
    expect(combinedSchema.safeParse({ ...sample, schemaVersion: 2 }).success).toBe(false)
  })

  it('rejects generatedAt without a UTC offset', () => {
    expect(combinedSchema.safeParse({ ...sample, generatedAt: '2026-11-18T10:00:00' }).success).toBe(false)
  })
})

describe('rowSchema', () => {
  it('accepts a shiny row with a denom and tier', () => {
    expect(rowSchema.parse(shinyRow)).toEqual(shinyRow)
  })

  it('rejects a shiny row with no denom', () => {
    const result = rowSchema.safeParse({ ...shinyRow, denom: null })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toMatch(/shiny rows need a denom and tier/)
  })

  it('rejects a non-shiny row that still carries odds', () => {
    const result = rowSchema.safeParse({ ...shinyRow, shiny: false, tier: null })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toMatch(/non-shiny rows must have denom and tier set to null/)
  })

  it('rejects an unknown tier', () => {
    expect(rowSchema.safeParse({ ...shinyRow, tier: 'mythic' }).success).toBe(false)
  })

  it.each([0, -3, 1.5])('rejects dex %s', (dex) => {
    expect(rowSchema.safeParse({ ...shinyRow, dex }).success).toBe(false)
  })
})
