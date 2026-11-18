import { describe, expect, it, vi } from 'vitest'
import sample from '../fixtures/combined.sample.json'
import { loadCombined } from './load-combined.ts'

const url = '/data/combined.json'

function respondWith(body: unknown, status = 200): typeof fetch {
  return vi.fn(async () => new Response(JSON.stringify(body), { status }))
}

describe('loadCombined', () => {
  it('returns validated live data', async () => {
    const fetchFn = respondWith(sample)
    const outcome = await loadCombined({ url }, fetchFn)
    expect(outcome.status).toBe('loaded')
    expect(outcome.status === 'loaded' && outcome.isSample).toBe(false)
    expect(outcome.status === 'loaded' && outcome.data.raids[0]?.name).toBe('Kyogre')
    expect(fetchFn).toHaveBeenCalledWith(url, expect.anything())
  })

  it('revalidates with the server instead of using a cached copy, so a deploy shows up on the next visit', async () => {
    const fetchFn = respondWith(sample)
    await loadCombined({ url }, fetchFn)
    expect(fetchFn).toHaveBeenCalledWith(url, expect.objectContaining({ cache: 'no-cache' }))
  })

  it('reports an error for a 404 when there is no sample fallback', async () => {
    const outcome = await loadCombined({ url }, respondWith({}, 404))
    expect(outcome).toEqual({ status: 'error', reason: expect.stringContaining('HTTP 404') })
  })

  it('reports an error for data that does not match the contract', async () => {
    const outcome = await loadCombined({ url }, respondWith({ ...sample, schemaVersion: 2 }))
    expect(outcome).toEqual({ status: 'error', reason: expect.stringContaining('does not match the data contract') })
  })

  it('reports an error when the network request itself fails', async () => {
    const outcome = await loadCombined({ url }, vi.fn(async () => Promise.reject(new TypeError('offline'))))
    expect(outcome).toEqual({ status: 'error', reason: expect.stringContaining('offline') })
  })

  it('falls back to the sample, flagged as such, when one is provided', async () => {
    const outcome = await loadCombined({ url, loadSample: async () => sample }, respondWith({}, 404))
    expect(outcome.status === 'loaded' && outcome.isSample).toBe(true)
  })
})
