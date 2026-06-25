/**
 * fetch() wrapper with a hard timeout and bounded retry/backoff.
 *
 * Used for outbound LLM / API calls (Anthropic, Google) which otherwise have no
 * timeout (a hung connection blocks the request indefinitely) and no retry
 * (a transient 429/503/529 surfaces as a hard error to the user).
 */

export interface FetchWithRetryOptions {
  /** Abort the request after this many ms (default 60s). */
  timeoutMs?: number
  /** Max number of retries after the first attempt (default 2 → up to 3 tries). */
  retries?: number
  /** HTTP status codes that trigger a retry. */
  retryOn?: number[]
}

const DEFAULT_RETRY_ON = [429, 500, 502, 503, 504, 529]

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Exponential backoff with jitter, honouring a `Retry-After` header when present. */
function backoffMs(attempt: number, res?: Response): number {
  if (res) {
    const retryAfter = res.headers.get('retry-after')
    if (retryAfter) {
      const secs = Number(retryAfter)
      if (Number.isFinite(secs) && secs >= 0) return Math.min(secs * 1000, 30_000)
    }
  }
  const base = Math.min(2 ** attempt * 500, 8_000)
  return base + Math.floor(Math.random() * 250)
}

export async function fetchWithRetry(
  input: string | URL,
  init: RequestInit = {},
  options: FetchWithRetryOptions = {},
): Promise<Response> {
  const { timeoutMs = 60_000, retries = 2, retryOn = DEFAULT_RETRY_ON } = options
  let lastError: unknown

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const res = await fetch(input, { ...init, signal: controller.signal })
      clearTimeout(timer)
      if (retryOn.includes(res.status) && attempt < retries) {
        await sleep(backoffMs(attempt, res))
        continue
      }
      return res
    } catch (err) {
      clearTimeout(timer)
      lastError = err
      if (attempt < retries) {
        await sleep(backoffMs(attempt))
        continue
      }
      throw err
    }
  }

  // Unreachable in practice (loop returns or throws), but satisfies the type checker.
  throw lastError instanceof Error ? lastError : new Error('fetchWithRetry: exhausted retries')
}
