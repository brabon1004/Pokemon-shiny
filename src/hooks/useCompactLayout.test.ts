/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { COMPACT_LAYOUT_QUERY } from './useCompactLayout.ts'

describe('COMPACT_LAYOUT_QUERY', () => {
  it('is the query app.css uses for the phone layout', () => {
    // Read from disk: Vitest replaces CSS imports, including ?raw, with an empty string.
    const appCss = readFileSync('src/styles/app.css', 'utf8')
    expect(appCss).toContain(`@media ${COMPACT_LAYOUT_QUERY} {`)
  })
})
