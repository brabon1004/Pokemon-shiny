function assertValidDenom(denom: number): void {
  if (!Number.isFinite(denom) || denom <= 0) {
    throw new RangeError(`denom must be a finite number greater than 0 (the N in "1 in N"), got ${denom}`)
  }
}

/** Probability of at least one shiny in `n` encounters at 1-in-`denom` odds. */
export function chanceOfAtLeastOne(denom: number, n: number): number {
  assertValidDenom(denom)
  if (!Number.isInteger(n) || n < 0) {
    throw new RangeError(`encounter count must be a whole number of 0 or more, got ${n}`)
  }
  if (n === 0) return 0
  if (denom <= 1) return 1
  // expm1/log1p avoid cancellation when 1/denom is tiny.
  return -Math.expm1(n * Math.log1p(-1 / denom))
}

/**
 * Smallest encounter count whose chance of at least one shiny reaches `target` (0 to 1).
 * Returns Infinity for target 1 at real odds, since no finite count guarantees a shiny.
 */
export function encountersForChance(denom: number, target: number): number {
  assertValidDenom(denom)
  if (!(target >= 0 && target <= 1)) {
    throw new RangeError(`target chance must be between 0 and 1 inclusive, got ${target}`)
  }
  if (target === 0) return 0
  if (denom <= 1) return 1
  if (target === 1) return Number.POSITIVE_INFINITY
  let encounters = Math.ceil(Math.log1p(-target) / Math.log1p(-1 / denom))
  // The log ratio can land a hair above an exact integer; step back once if k-1 already reaches the target.
  if (encounters > 1 && chanceOfAtLeastOne(denom, encounters - 1) >= target) encounters--
  return encounters
}
