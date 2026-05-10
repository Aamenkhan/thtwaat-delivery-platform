export async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { maxAttempts: number; baseDelayMs?: number } = { maxAttempts: 3 }
): Promise<T> {
  let last: unknown
  const base = opts.baseDelayMs ?? 400
  for (let i = 0; i < opts.maxAttempts; i++) {
    try {
      return await fn()
    } catch (e) {
      last = e
      if (i === opts.maxAttempts - 1) break
      await sleep(Math.min(30_000, base * 2 ** i))
    }
  }
  throw last
}
