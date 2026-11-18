import { describe, expect, it } from 'vitest'
import { formatEventEnd } from './event-end.ts'

describe('formatEventEnd', () => {
  it('shows a local-time event ending at its wall-clock time, whatever the viewer timezone', () => {
    const window = { start: '2026-11-16T10:00:00.000', end: '2026-11-23T20:00:00.000', local: true }
    expect(formatEventEnd(window, 'Asia/Tokyo')).toBe('Until Mon, Nov 23, 8 PM')
    expect(formatEventEnd(window, 'America/Los_Angeles')).toBe('Until Mon, Nov 23, 8 PM')
  })
  it("shows a UTC event's end in the viewer's timezone", () => {
    const window = { start: '2026-11-18T21:00:00.000Z', end: '2026-11-25T21:00:00.000Z', local: false }
    expect(formatEventEnd(window, 'America/New_York')).toBe('Until Wed, Nov 25, 4 PM')
    expect(formatEventEnd(window, 'Asia/Tokyo')).toBe('Until Thu, Nov 26, 6 AM')
  })
  it('includes minutes only when the end is not on the hour', () => {
    const window = { start: '2026-11-14T17:00:00.000', end: '2026-11-19T23:59:00.000', local: true }
    expect(formatEventEnd(window)).toBe('Until Thu, Nov 19, 11:59 PM')
  })
  it('returns null for an end time it cannot read', () => {
    expect(formatEventEnd({ start: '2026-11-14T17:00:00.000', end: 'next Sunday', local: true })).toBeNull()
  })
})
