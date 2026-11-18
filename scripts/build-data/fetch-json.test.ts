import { describe, expect, it } from 'vitest'
import { fetchJson } from './fetch-json.ts'

const URL_UNDER_TEST = 'https://example.test/raids.min.json'

function fakeFetch(...responses: Array<Response | Error>): typeof fetch & { calls: number } {
  const queue = [...responses]
  const fake = async (): Promise<Response> => {
    fake.calls++
    const next = queue.shift()
    if (next === undefined) throw new Error('fakeFetch ran out of responses')
    if (next instanceof Error) throw next
    return next
  }
  fake.calls = 0
  return fake
}

const noSleep = async (): Promise<void> => {}

describe('fetchJson', () => {
  it('returns the parsed body of a 200 response', async () => {
    const fetchImpl = fakeFetch(Response.json([{ name: 'Darkrai' }]))
    await expect(fetchJson(URL_UNDER_TEST, { fetchImpl, sleep: noSleep })).resolves.toEqual([{ name: 'Darkrai' }])
  })

  it('retries a 503 and a network error with doubling backoff, then succeeds', async () => {
    const fetchImpl = fakeFetch(new Response('busy', { status: 503 }), new TypeError('fetch failed'), Response.json({ ok: 1 }))
    const sleeps: number[] = []
    const sleep = async (ms: number): Promise<void> => {
      sleeps.push(ms)
    }
    await expect(fetchJson(URL_UNDER_TEST, { fetchImpl, sleep, backoffMs: 100, jitter: () => 0 })).resolves.toEqual({ ok: 1 })
    expect(fetchImpl.calls).toBe(3)
    expect(sleeps).toEqual([100, 200])
  })

  it('does not retry a 404 and names the URL and status', async () => {
    const fetchImpl = fakeFetch(new Response('', { status: 404, statusText: 'Not Found' }))
    await expect(fetchJson(URL_UNDER_TEST, { fetchImpl, sleep: noSleep })).rejects.toThrow(
      `unable to fetch ${URL_UNDER_TEST}: HTTP 404 Not Found (not retried)`,
    )
    expect(fetchImpl.calls).toBe(1)
  })

  it('gives up after 1 + retries attempts and reports the last failure', async () => {
    const timeout = new DOMException('signal timed out', 'TimeoutError')
    const fetchImpl = fakeFetch(timeout, timeout, timeout)
    await expect(fetchJson(URL_UNDER_TEST, { fetchImpl, sleep: noSleep })).rejects.toThrow(
      `unable to fetch ${URL_UNDER_TEST} after 3 attempts: timed out`,
    )
    expect(fetchImpl.calls).toBe(3)
  })

  it('reports a body that is not JSON without retrying', async () => {
    const fetchImpl = fakeFetch(new Response('<html>maintenance</html>'))
    await expect(fetchJson(URL_UNDER_TEST, { fetchImpl, sleep: noSleep })).rejects.toThrow(
      `unable to parse JSON from ${URL_UNDER_TEST}`,
    )
    expect(fetchImpl.calls).toBe(1)
  })
})
