import type { ErrorRequestHandler } from 'express'
import { HttpError } from '../lib/http-error.js'

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({
      ok: false,
      error: { message: err.message, details: err.details },
    })
    return
  }
  console.error(err)
  res.status(500).json({
    ok: false,
    error: { message: 'Internal server error' },
  })
}
