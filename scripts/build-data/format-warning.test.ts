import { describe, expect, it } from 'vitest'
import { formatError, formatWarning } from './format-warning.ts'

describe('formatWarning', () => {
  it('returns the message unchanged outside GitHub Actions', () => {
    expect(formatWarning('shiny list fell back to snapshot', {})).toBe('shiny list fell back to snapshot')
    expect(formatWarning('x', { GITHUB_ACTIONS: 'false' })).toBe('x')
  })

  it('emits a workflow warning annotation inside GitHub Actions, escaping characters the command syntax reserves', () => {
    expect(formatWarning('Unmapped raid tiers (using raid:default): Elite Raids', { GITHUB_ACTIONS: 'true' })).toBe(
      '::warning::Unmapped raid tiers (using raid:default): Elite Raids',
    )
    expect(formatWarning('50% done\nnext line\r', { GITHUB_ACTIONS: 'true' })).toBe('::warning::50%25 done%0Anext line%0D')
  })
})

describe('formatError', () => {
  it('returns the message unchanged outside GitHub Actions', () => {
    expect(formatError('build:data failed: timeout', {})).toBe('build:data failed: timeout')
  })

  it('emits one workflow error annotation, so an upstream message cannot inject a second command', () => {
    const formatted = formatError('build:data failed: bad data\n::error::boom', { GITHUB_ACTIONS: 'true' })
    expect(formatted).toBe('::error::build:data failed: bad data%0A::error::boom')
    expect(formatted).not.toMatch(/[\r\n]/)
  })
})
