import { mkdtemp, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { writeFileAtomic } from './write-file-atomic.ts'

let workDir: string

beforeEach(async () => {
  workDir = await mkdtemp(join(tmpdir(), 'write-file-atomic-'))
})
afterEach(async () => {
  await rm(workDir, { recursive: true, force: true })
})

describe('writeFileAtomic', () => {
  it('creates missing parent directories and leaves only the target file', async () => {
    const target = join(workDir, 'public', 'data', 'combined.json')
    await writeFileAtomic(target, '{"a":1}\n')
    expect(await readFile(target, 'utf8')).toBe('{"a":1}\n')
    expect(await readdir(join(workDir, 'public', 'data'))).toEqual(['combined.json'])
  })

  it('replaces an existing file', async () => {
    const target = join(workDir, 'combined.json')
    await writeFile(target, 'old')
    await writeFileAtomic(target, 'new')
    expect(await readFile(target, 'utf8')).toBe('new')
  })

  it('removes its temp file and keeps the old content when the rename fails', async () => {
    // Renaming a file onto an existing directory fails on every platform.
    const target = join(workDir, 'occupied')
    await writeFileAtomic(join(target, 'keep.txt'), 'keep')
    await expect(writeFileAtomic(target, 'new')).rejects.toThrow(/unable to write .*occupied/)
    expect((await readdir(workDir)).sort()).toEqual(['occupied'])
    expect(await readFile(join(target, 'keep.txt'), 'utf8')).toBe('keep')
  })

  describe('when another process holds the target (Windows EPERM)', () => {
    const busy = (code: string) => Object.assign(new Error(`${code}: operation not permitted, rename`), { code })

    it('retries the rename with growing delays until it succeeds', async () => {
      const target = join(workDir, 'combined.json')
      const failures = [busy('EPERM'), busy('EBUSY')]
      let attempts = 0
      const delays: number[] = []
      await writeFileAtomic(target, 'new', {
        rename: async (from, to) => {
          attempts += 1
          const failure = failures.shift()
          if (failure !== undefined) throw failure
          await rename(from, to)
        },
        delay: async (ms) => {
          delays.push(ms)
        },
      })
      expect(attempts).toBe(3)
      expect(delays).toEqual([50, 100])
      expect(await readFile(target, 'utf8')).toBe('new')
    })

    it('gives up after 5 attempts, removes its temp file, and reports the last error', async () => {
      const target = join(workDir, 'combined.json')
      await writeFile(target, 'old')
      let attempts = 0
      const write = writeFileAtomic(target, 'new', {
        rename: async () => {
          attempts += 1
          throw busy('EACCES')
        },
        delay: async () => {},
      })
      await expect(write).rejects.toThrow(/unable to write .*combined\.json: EACCES/)
      expect(attempts).toBe(5)
      expect(await readdir(workDir)).toEqual(['combined.json'])
      expect(await readFile(target, 'utf8')).toBe('old')
    })

    it('does not retry errors a retry cannot fix', async () => {
      let attempts = 0
      const write = writeFileAtomic(join(workDir, 'combined.json'), 'new', {
        rename: async () => {
          attempts += 1
          throw busy('ENOENT')
        },
        delay: async () => {},
      })
      await expect(write).rejects.toThrow(/ENOENT/)
      expect(attempts).toBe(1)
    })
  })
})
