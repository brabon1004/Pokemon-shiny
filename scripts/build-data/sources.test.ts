import { describe, expect, it } from 'vitest'
import { loadShinyList } from './sources.ts'

const LIVE = [{ dex: 1, aa_fn: 'pm1', released_date: '2018/03/25' }]
const SNAPSHOT = [{ dex: 4, aa_fn: 'pm4', released_date: '2018/05/19' }]

function harness(fetchLive: () => Promise<unknown>) {
  const warnings: string[] = []
  return {
    warnings,
    deps: {
      fetchLive,
      readSnapshot: async (): Promise<unknown> => SNAPSHOT,
      warn: (message: string) => warnings.push(message),
    },
  }
}

describe('loadShinyList', () => {
  it('uses the live list when it validates', async () => {
    const { deps, warnings } = harness(async () => LIVE)
    await expect(loadShinyList(deps)).resolves.toEqual({ entries: LIVE, origin: 'live' })
    expect(warnings).toEqual([])
  })

  it('falls back to the snapshot with a warning when the fetch fails', async () => {
    const { deps, warnings } = harness(async () => {
      throw new Error('unable to fetch https://leekduck.com/shiny/pms.json after 3 attempts: timed out')
    })
    await expect(loadShinyList(deps)).resolves.toEqual({ entries: SNAPSHOT, origin: 'snapshot' })
    expect(warnings).toEqual([
      'LeekDuck shiny list unavailable, using data/shiny-list.snapshot.json: unable to fetch https://leekduck.com/shiny/pms.json after 3 attempts: timed out',
    ])
  })

  it('falls back to the snapshot when the live list has an unexpected shape', async () => {
    const { deps, warnings } = harness(async () => [{ dex: 'one' }])
    await expect(loadShinyList(deps)).resolves.toMatchObject({ origin: 'snapshot' })
    expect(warnings[0]).toMatch(/^LeekDuck shiny list unavailable, using data\/shiny-list.snapshot.json: invalid shape at \[0\]\.dex/)
  })
})
