import type { ErrorRequestHandler } from 'express'
import { HttpError } from '../lib/http-error.js'
import { publicMessageForUnexpectedError } from '../lib/public-error-message.js'

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({
      ok: false,
      error: { message: err.message, details: err.details },
    })
    return
  }
  const mapped = publicMessageForUnexpectedError(err)
  if (mapped) {
    console.error('[api]', mapped.message, err)
    res.status(mapped.status).json({
      ok: false,
      error: { message: mapped.message },
    })
    return
  }
  console.error(err)
  res.status(500).json({
    ok: false,
    error: { message: 'Internal server error' },
  })
}
