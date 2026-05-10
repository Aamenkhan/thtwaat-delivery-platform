import rateLimit from 'express-rate-limit'
import type { Request, RequestHandler } from 'express'

/** Apply after `requireApiKey` so `req.apiKeyAuth` is set. */
export function apiKeyRateLimiter(): RequestHandler {
  return rateLimit({
    windowMs: 60_000,
    max: async (req: Request) => req.apiKeyAuth?.rateLimitPerMinute ?? 60,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request) =>
      req.apiKeyAuth?.id ? `apikey:${req.apiKeyAuth.id}` : `ip:${req.ip}`,
  })
}
