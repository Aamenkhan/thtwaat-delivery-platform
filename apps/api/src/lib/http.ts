import type { Context } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'

export function jsonOk<T>(
  c: Context,
  data: T,
  status: ContentfulStatusCode = 200
) {
  return c.json({ ok: true as const, data }, status)
}

export function jsonError(
  c: Context,
  code: string,
  message: string,
  status: ContentfulStatusCode = 400,
  details?: unknown
) {
  return c.json(
    { ok: false as const, error: { code, message, details } },
    status
  )
}
