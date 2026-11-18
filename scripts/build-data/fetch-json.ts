export const DEFAULT_TIMEOUT_MS = 15_000
export const DEFAULT_RETRIES = 2
export const DEFAULT_BACKOFF_MS = 1_000

export interface FetchOptions {
  timeoutMs?: number
  /** Extra attempts after the first, for timeouts, network errors, 429, and 5xx. */
  retries?: number
  /** Wait before retry n (1-based) is backoffMs × 2^(n-1), plus jitter. */
  backoffMs?: number
  /** Returns extra wait in ms for a given base wait; defaults to up to 25% random jitter. */
  jitter?: (baseMs: number) => number
  fetchImpl?: typeof fetch
  sleep?: (ms: number) => Promise<void>
}

class RetryableError extends Error {}

/** GET a text body with a per-attempt timeout and retries for transient failures. */
export async function fetchText(url: string, options: FetchOptions = {}): Promise<string> {
  const {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    retries = DEFAULT_RETRIES,
    backoffMs = DEFAULT_BACKOFF_MS,
    jitter = (baseMs: number) => Math.random() * baseMs * 0.25,
    fetchImpl = fetch,
    sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
  } = options

  let lastError: unknown
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      const baseMs = backoffMs * 2 ** (attempt - 1)
      await sleep(baseMs + jitter(baseMs))
    }
    try {
      const response = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs) })
      if (response.ok) return await response.text()
      const statusError = `HTTP ${response.status} ${response.statusText}`.trim()
      if (response.status === 429 || response.status >= 500) throw new RetryableError(statusError)
      throw new Error(`unable to fetch ${url}: ${statusError} (not retried)`)
    } catch (error) {
      if (!(error instanceof RetryableError) && !isNetworkError(error)) throw error
      lastError = error
    }
  }
  throw new Error(`unable to fetch ${url} after ${retries + 1} attempts: ${describe(lastError)}`, { cause: lastError })
}

/** GET and JSON.parse; the result is `unknown` until a zod schema validates it. */
export async function fetchJson(url: string, options: FetchOptions = {}): Promise<unknown> {
  const body = await fetchText(url, options)
  try {
    return JSON.parse(body)
  } catch (error) {
    throw new Error(`unable to parse JSON from ${url}: ${describe(error)}`, { cause: error })
  }
}

/** fetch rejects with TypeError for DNS/connection failures and with TimeoutError when the signal fires. */
function isNetworkError(error: unknown): boolean {
  return error instanceof TypeError || (error instanceof Error && error.name === 'TimeoutError')
}

function describe(error: unknown): string {
  if (!(error instanceof Error)) return String(error)
  return error.name === 'TimeoutError' ? 'timed out' : error.message
}
