import { chanceOfAtLeastOne, encountersForChance } from '../shared/odds.ts'

export type ParsedInput = { ok: true; value: number } | { ok: false; message: string }

export const MILESTONE_TARGETS = [0.5, 0.9, 0.99] as const

export interface ShinyChance {
  chance: number
  milestones: { target: number; encounters: number }[]
}

const NUMERIC = /^\d+(?:\.\d+)?$/

export function parseDenomInput(input: string): ParsedInput {
  const trimmed = input.trim()
  const denom = Number(trimmed)
  if (!NUMERIC.test(trimmed) || !Number.isFinite(denom) || denom < 1) {
    return { ok: false, message: 'Enter odds of 1 or more, like 64.' }
  }
  return { ok: true, value: denom }
}

export function parseEncountersInput(input: string): ParsedInput {
  const trimmed = input.trim()
  const encounters = Number(trimmed)
  if (!/^\d+$/.test(trimmed) || !Number.isSafeInteger(encounters)) {
    return { ok: false, message: 'Enter a whole number of encounters, like 50.' }
  }
  return { ok: true, value: encounters }
}

/** Inputs must already be parsed: denom ≥ 1 and a whole encounter count ≥ 0. */
export function calculateShinyChance(denom: number, encounters: number): ShinyChance {
  return {
    chance: chanceOfAtLeastOne(denom, encounters),
    milestones: MILESTONE_TARGETS.map((target) => ({ target, encounters: encountersForChance(denom, target) })),
  }
}
