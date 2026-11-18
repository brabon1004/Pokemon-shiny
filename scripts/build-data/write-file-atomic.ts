import { randomBytes } from 'node:crypto'
import { mkdir, open, rename, rm } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'

/** Windows refuses to replace a file another process has open (a dev server, an editor, antivirus) until it lets go. */
const RENAME_ATTEMPTS = 5
const RENAME_RETRY_STEP_MS = 50
const BUSY_TARGET_CODES = new Set(['EPERM', 'EBUSY', 'EACCES'])

export interface WriteFileAtomicDeps {
  rename: (from: string, to: string) => Promise<void>
  delay: (ms: number) => Promise<unknown>
}

const DEFAULT_DEPS: WriteFileAtomicDeps = { rename, delay: (ms) => sleep(ms) }

/**
 * Writes to a temp file in the target's own directory (so rename never crosses filesystems), flushes it to disk,
 * then renames it over the target. Readers see the old file or the new one, never half of one.
 */
export async function writeFileAtomic(
  targetPath: string,
  content: string,
  deps: WriteFileAtomicDeps = DEFAULT_DEPS,
): Promise<void> {
  const directory = dirname(targetPath)
  await mkdir(directory, { recursive: true })
  const tempPath = join(directory, `.${basename(targetPath)}.${randomBytes(6).toString('hex')}.tmp`)
  try {
    const handle = await open(tempPath, 'wx')
    try {
      await handle.writeFile(content, 'utf8')
      await handle.sync()
    } finally {
      await handle.close()
    }
    await renameWithRetry(tempPath, targetPath, deps)
  } catch (error) {
    await rm(tempPath, { force: true })
    throw new Error(`unable to write ${targetPath}: ${error instanceof Error ? error.message : String(error)}`, {
      cause: error,
    })
  }
}

async function renameWithRetry(from: string, to: string, deps: WriteFileAtomicDeps): Promise<void> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      await deps.rename(from, to)
      return
    } catch (error) {
      if (attempt >= RENAME_ATTEMPTS || !isBusyTargetError(error)) throw error
      await deps.delay(RENAME_RETRY_STEP_MS * attempt)
    }
  }
}

function isBusyTargetError(error: unknown): boolean {
  return error instanceof Error && 'code' in error && typeof error.code === 'string' && BUSY_TARGET_CODES.has(error.code)
}
