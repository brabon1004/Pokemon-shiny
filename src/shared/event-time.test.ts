import { describe, expect, it } from 'vitest'
import { isLocalTime, parseEventTime } from './event-time.ts'

describe('isLocalTime', () => {
  it('treats a time with no Z or offset as local wall-clock time', () => {
    expect(isLocalTime('2026-11-21T14:00:00.000')).toBe(true)
  })

  it('treats a time ending in Z or a numeric offset as absolute', () => {
    expect(isLocalTime('2026-11-21T14:00:00.000Z')).toBe(false)
    expect(isLocalTime('2026-11-21T14:00:00+02:00')).toBe(false)
    expect(isLocalTime('2026-11-21T14:00:00-0500')).toBe(false)
  })
})

describe('parseEventTime', () => {
  it('reads an absolute time the same way in either zone', () => {
    const expected = Date.UTC(2026, 10, 21, 12, 0, 0)
    expect(parseEventTime('2026-11-21T14:00:00+02:00', 'utc')).toBe(expected)
    expect(parseEventTime('2026-11-21T14:00:00+02:00', 'viewer')).toBe(expected)
  })

  it("reads a local time as UTC for 'utc' and in the viewer's timezone for 'viewer'", () => {
    expect(parseEventTime('2026-11-21T14:00:00.000', 'utc')).toBe(Date.UTC(2026, 10, 21, 14, 0, 0))
    expect(parseEventTime('2026-11-21T14:00:00.000', 'viewer')).toBe(new Date(2026, 10, 21, 14, 0, 0).getTime())
  })

  it('returns NaN for a string that is not a time', () => {
    expect(parseEventTime('next Sunday', 'utc')).toBeNaN()
  })
})
