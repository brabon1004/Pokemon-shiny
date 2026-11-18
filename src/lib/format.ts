const wholeNumber = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
const odds = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 })

export function formatOdds(denom: number): string {
  return `1 in ${odds.format(denom)}`
}

/** Chance per single encounter, e.g. 1 in 512 → "0.20%". */
export function formatPerEncounterPercent(denom: number): string {
  const percent = 100 / denom
  return `${percent >= 1 ? percent.toFixed(1) : percent.toFixed(2)}%`
}

/** A 0–1 probability as a percent with one decimal, clamped so rounding never claims 0% or 100% falsely. */
export function formatChance(chance: number): string {
  if (chance > 0 && chance < 0.0005) return '<0.1%'
  if (chance < 1 && chance >= 0.9995) return '>99.9%'
  return `${(chance * 100).toFixed(1)}%`
}

/** A row or item count with thousands separators, e.g. 1234 → "1,234". */
export function formatCount(count: number): string {
  return wholeNumber.format(count)
}

export function formatEncounters(count: number): string {
  if (!Number.isFinite(count)) return 'never guaranteed'
  return `${wholeNumber.format(count)} ${count === 1 ? 'encounter' : 'encounters'}`
}

export function formatDex(dex: number): string {
  return `#${String(dex).padStart(3, '0')}`
}
