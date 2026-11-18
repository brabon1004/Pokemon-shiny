import type { Row } from '../../../src/shared/contract.ts'

/** An upstream entry dropped because its image had no usable dex number, or (All tab) its dex has no English name. */
export interface SkippedEntry {
  tab: string
  name: string
  image: string
}

export interface NormalizeResult {
  rows: Row[]
  skipped: SkippedEntry[]
}

/** Keys must be unique per tab; upstream order decides which duplicate survives (first wins). */
export function dedupeByKey(rows: readonly Row[]): Row[] {
  const seenKeys = new Set<string>()
  return rows.filter((row) => {
    if (seenKeys.has(row.key)) return false
    seenKeys.add(row.key)
    return true
  })
}
