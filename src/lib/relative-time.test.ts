import { describe, expect, it } from 'vitest'
import { formatUpdatedAgo } from './relative-time.ts'

const generatedAt = '2026-11-18T14:00:00Z'
const after = (ms: number) => new Date(Date.parse(generatedAt) + ms)
const MINUTE = 60_000

describe('formatUpdatedAgo', () => {
  it('says "just now" under a minute and for timestamps in the future', () => {
    expect(formatUpdatedAgo(generatedAt, after(59_000))).toBe('Updated just now')
    expect(formatUpdatedAgo(generatedAt, after(-5 * MINUTE))).toBe('Updated just now')
  })

  it('counts whole minutes, then hours, then days', () => {
    expect(formatUpdatedAgo(generatedAt, after(MINUTE))).toBe('Updated 1 minute ago')
    expect(formatUpdatedAgo(generatedAt, after(59 * MINUTE))).toBe('Updated 59 minutes ago')
    expect(formatUpdatedAgo(generatedAt, after(60 * MINUTE))).toBe('Updated 1 hour ago')
    expect(formatUpdatedAgo(generatedAt, after(150 * MINUTE))).toBe('Updated 2 hours ago')
    expect(formatUpdatedAgo(generatedAt, after(24 * 60 * MINUTE))).toBe('Updated 1 day ago')
    expect(formatUpdatedAgo(generatedAt, after(80 * 60 * MINUTE))).toBe('Updated 3 days ago')
  })

  it('falls back to a plain label for an unparseable timestamp', () => {
    expect(formatUpdatedAgo('not a date', after(0))).toBe('Update time unknown')
  })
})
