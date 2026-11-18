import { createHash } from 'node:crypto'
import type { Row } from '../../../src/shared/contract.ts'
import type { Rates } from '../../../src/shared/rates.ts'
import { parseDex } from '../dex.ts'
import { resolveTier } from '../resolve-tier.ts'
import type { ResearchTask } from '../upstream-schemas.ts'
import { dedupeByKey, type NormalizeResult, type SkippedEntry } from './common.ts'

const TASK_HASH_LENGTH = 8

export function normalizeResearch(tasks: readonly ResearchTask[], rates: Rates): NormalizeResult {
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
      const odds = resolveTier(rates, { dex, encounterType: 'research', canBeShiny: reward.canBeShiny })
      rows.push({ key: `research:${taskId}:${reward.name}`, dex, name: reward.name, source: taskText, ...odds })
    }
  }
  return { rows: dedupeByKey(rows), skipped }
}

const FALLBACK_TASK_TEXT = 'Field research'
const NAMED_ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }
const TAG_PATTERN = /<[^>]*>/g

/**
 * Task text arrives as HTML. The output is plain text only: tags become spaces (so `</span><span>` cannot glue two
 * words together), a few common entities are decoded, then tags are removed again so an encoded `&lt;img&gt;`
 * cannot turn into markup. Whitespace is collapsed last.
 */
function htmlToText(html: string): string {
  const decoded = html
    .replace(TAG_PATTERN, ' ')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, body: string) => decodeEntity(body) ?? entity)
  const text = decoded.replace(TAG_PATTERN, ' ').replace(/\s+/g, ' ').trim()
  return text === '' ? FALLBACK_TASK_TEXT : text
}

function decodeEntity(body: string): string | undefined {
  if (body[0] !== '#') return NAMED_ENTITIES[body.toLowerCase()]
  const codePoint = body[1] === 'x' || body[1] === 'X' ? Number.parseInt(body.slice(2), 16) : Number(body.slice(1))
  return Number.isInteger(codePoint) && codePoint > 0 && codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : undefined
}
