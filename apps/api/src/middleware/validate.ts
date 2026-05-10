import type { RequestHandler } from 'express'
import type { ZodSchema } from 'zod'
import { HttpError } from '../lib/http-error.js'

export function validateBody<T>(schema: ZodSchema<T>): RequestHandler {
  return (req, _res, next) => {
    const r = schema.safeParse(req.body)
    if (!r.success) {
      next(new HttpError(422, 'Validation failed', r.error.flatten()))
      return
    }
    req.body = r.data
    next()
  }
}

export function validateQuery<T>(schema: ZodSchema<T>): RequestHandler {
  return (req, _res, next) => {
    const r = schema.safeParse(req.query)
    if (!r.success) {
      next(new HttpError(422, 'Validation failed', r.error.flatten()))
      return
    }
    req.query = r.data as typeof req.query
    next()
  }
}
