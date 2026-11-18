import { combinedSchema, type Combined } from '../shared/contract.ts'

export interface CombinedSource {
  url: string
  /** Dev-only fallback used when the live file can't be loaded. */
  loadSample?: () => Promise<unknown>
}

export type LoadOutcome =
  | { status: 'loaded'; data: Combined; isSample: boolean }
  | { status: 'error'; reason: string }

function parseCombined(body: unknown, origin: string): Combined {
  const parsed = combinedSchema.safeParse(body)
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]
    throw new Error(`${origin} does not match the data contract: ${firstIssue?.message ?? 'unknown issue'}`)
  }
  return parsed.data
}

async function fetchCombined(url: string, fetchFn: typeof fetch, signal?: AbortSignal): Promise<Combined> {
  // 'no-cache' checks with the server every time (a cheap 304 when unchanged), so newer code never reads a stale cached file.
  const response = await fetchFn(url, { signal, cache: 'no-cache' })
  if (!response.ok) throw new Error(`HTTP ${response.status} fetching ${url}`)
  return parseCombined(await response.json(), url)
}

/** Fetch and validate combined.json. Abort errors propagate so callers can ignore them. */
export async function loadCombined(
  source: CombinedSource,
  fetchFn: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<LoadOutcome> {
  try {
    return { status: 'loaded', data: await fetchCombined(source.url, fetchFn, signal), isSample: false }
  } catch (error) {
    if (signal?.aborted) throw error
    const reason = error instanceof Error ? error.message : String(error)
    if (!source.loadSample) return { status: 'error', reason }
    console.warn(`Unable to load ${source.url} (${reason}); showing the bundled sample data instead.`)
    return { status: 'loaded', data: parseCombined(await source.loadSample(), 'sample data'), isSample: true }
  }
}
