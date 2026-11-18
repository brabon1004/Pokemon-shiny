export const DEFAULT_TIMEOUT_MS = 15_000
export const DEFAULT_RETRIES = 2
export const DEFAULT_BACKOFF_MS = 1_000
/** Default body cap for fetchJson. The upstream feeds are 100–200 KB, so this only stops a runaway or hostile body. */
export const MAX_JSON_BODY_BYTES = 20 * 1024 * 1024

export interface FetchOptions {
  timeoutMs?: number
  /** Extra attempts after the first, for timeouts, network errors, 429, and 5xx. */
  retries?: number
  /** Wait before retry n (1-based) is backoffMs × 2^(n-1), plus jitter. */
  backoffMs?: number
  /** Returns extra wait in ms for a given base wait; defaults to up to 25% random jitter. */
  jitter?: (baseMs: number) => number
  /** `'manual'` reports a 3xx as a failure instead of following it, so an allowlisted URL can't lead elsewhere. */
  redirect?: RequestInit['redirect']
  /** Refuse a larger body (checked against Content-Length, then while reading). No limit when omitted. */
  maxBodyBytes?: number
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
    redirect = 'follow',
    maxBodyBytes,
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
      const response = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs), redirect })
      if (response.ok) return maxBodyBytes === undefined ? await response.text() : await readCapped(url, response, maxBodyBytes)
      if (response.type === 'opaqueredirect' || (response.status >= 300 && response.status < 400)) {
        const location = response.headers.get('location') ?? '(no location)'
        throw new Error(`unable to fetch ${url}: redirected to ${location} (not followed)`)
      }
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

/** GET and JSON.parse; the result is `unknown` until a zod schema validates it. Bodies over MAX_JSON_BODY_BYTES fail. */
export async function fetchJson(url: string, options: FetchOptions = {}): Promise<unknown> {
  const body = await fetchText(url, { ...options, maxBodyBytes: options?.maxBodyBytes ?? MAX_JSON_BODY_BYTES })
  try {
    return JSON.parse(body)
  } catch (error) {
    throw new Error(`unable to parse JSON from ${url}: ${describe(error)}`, { cause: error })
  }
}

async function readCapped(url: string, response: Response, maxBodyBytes: number): Promise<string> {
  const tooLarge = () => new Error(`unable to fetch ${url}: body is over ${maxBodyBytes} bytes (not retried)`)
  const declaredLength = Number(response.headers.get('content-length'))
  if (declaredLength > maxBodyBytes) {
    await response.body?.cancel()
    throw tooLarge()
  }
  if (response.body === null) return ''
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let text = ''
  let bytesRead = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) return text + decoder.decode()
    bytesRead += value.byteLength
    if (bytesRead > maxBodyBytes) {
      await reader.cancel()
      throw tooLarge()
    }
    text += decoder.decode(value, { stream: true })
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
