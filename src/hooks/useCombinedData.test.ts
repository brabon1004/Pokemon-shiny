import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import sample from '../fixtures/combined.sample.json'
import { useCombinedData } from './useCombinedData.ts'

const liveOnly = { url: '/Pokemon-shiny/data/combined.json' }

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useCombinedData', () => {
  it('goes loading → error on a 404, then loaded after retry succeeds', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('missing', { status: 404 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(sample), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() => useCombinedData(liveOnly))
    expect(result.current.state.status).toBe('loading')
    await waitFor(() => expect(result.current.state.status).toBe('error'))

    act(() => result.current.retry())
    expect(result.current.state.status).toBe('loading')
    await waitFor(() => expect(result.current.state.status).toBe('loaded'))
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const { state } = result.current
    expect(state.status === 'loaded' && state.data.generatedAt).toBe('2026-11-18T14:00:00Z')
  })
})
