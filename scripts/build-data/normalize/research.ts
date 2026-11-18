import { createHash } from 'node:crypto'
import type { Row } from '../../../src/shared/contract.ts'
import type { Rates } from '../../../src/shared/rates.ts'
import { parseDex } from '../dex.ts'
import { htmlToPlainText } from '../html-text.ts'
import { resolveTier } from '../resolve-tier.ts'
import { isShinyAvailable } from '../shiny-keys.ts'
import type { ResearchTask } from '../upstream-schemas.ts'
import { dedupeByKey, type NormalizeResult, type SkippedEntry } from './common.ts'

const TASK_HASH_LENGTH = 8

export function normalizeResearch(
  tasks: readonly ResearchTask[],
  rates: Rates,
  releasedKeys: ReadonlySet<string>,
): NormalizeResult {
  const rows: Row[] = []
  const skipped: SkippedEntry[] = []
  for (const task of tasks) {
    const taskText = htmlToText(task.text)
    // A hash of the text, not the array index, so keys stay stable when upstream reorders tasks.
    const taskId = createHash('sha256').update(taskText).digest('hex').slice(0, TASK_HASH_LENGTH)
    for (const reward of task.rewards) {
      const dex = parseDex(reward.image)
      if (dex === null) {
        skipped.push({ tab: 'research', name: reward.name, image: reward.image })
        continue
      }
      const odds = resolveTier(rates, { dex, encounterType: 'research', canBeShiny: isShinyAvailable(reward.canBeShiny, reward.image, releasedKeys) })
      rows.push({ key: `research:${taskId}:${reward.name}`, dex, name: reward.name, source: taskText, ...odds })
    }
  }
  return { rows: dedupeByKey(rows), skipped }
}

const FALLBACK_TASK_TEXT = 'Field research'

/** Task text arrives as HTML; a task with no text left after stripping gets a generic label. */
function htmlToText(html: string): string {
  return htmlToPlainText(html) || FALLBACK_TASK_TEXT
}
