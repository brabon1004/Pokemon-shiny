import { useCallback, useEffect, useState } from 'react'
import { loadCombined, type CombinedSource, type LoadOutcome } from '../lib/load-combined.ts'

export type CombinedDataState = { status: 'loading' } | LoadOutcome

// The sample fallback only exists in dev; `import.meta.env.DEV` is false in builds, so the fixture is never bundled.
const LIVE_SOURCE: CombinedSource = {
  url: `${import.meta.env.BASE_URL}data/combined.json`,
  loadSample: import.meta.env.DEV
    ? () => import('../fixtures/combined.sample.json').then((module) => module.default)
    : undefined,
}

export function useCombinedData(source: CombinedSource = LIVE_SOURCE): {
  state: CombinedDataState
  retry: () => void
} {
  const [state, setState] = useState<CombinedDataState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    loadCombined(source, fetch, controller.signal).then(setState, (error: unknown) => {
      if (controller.signal.aborted) return
      setState({ status: 'error', reason: error instanceof Error ? error.message : String(error) })
    })
    return () => controller.abort()
  }, [source, attempt])

  const retry = useCallback(() => {
    setState({ status: 'loading' })
    setAttempt((count) => count + 1)
  }, [])

  return { state, retry }
}
