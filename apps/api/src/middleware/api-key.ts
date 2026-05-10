import type { RequestHandler } from 'express'
import { prisma } from '../lib/prisma.js'
import { HttpError } from '../lib/http-error.js'
import { hashApiKey } from '../lib/api-key-crypto.js'

export function requireApiKey(...requiredScopes: string[]): RequestHandler {
  return async (req, _res, next) => {
    try {
      const raw = req.headers['x-api-key']
      if (typeof raw !== 'string' || !raw.trim()) {
        throw new HttpError(401, 'Missing X-Api-Key header')
      }
      const keyHash = hashApiKey(raw.trim())
      const record = await prisma.apiKey.findUnique({
        where: { keyHash },
        include: { seller: { select: { organizationId: true } } },
      })
      if (!record?.active) {
        throw new HttpError(401, 'Invalid API key')
      }
      for (const s of requiredScopes) {
        if (!record.scopes.includes(s)) {
          throw new HttpError(403, `Missing scope: ${s}`)
        }
      }
      await prisma.apiKey.update({
        where: { id: record.id },
        data: { lastUsedAt: new Date() },
      })
      req.apiKeyAuth = {
        id: record.id,
        sellerId: record.sellerId,
        organizationId: record.seller.organizationId,
        rateLimitPerMinute: record.rateLimitPerMinute,
        scopes: record.scopes,
      }
      next()
    } catch (e) {
      next(e)
    }
  }
}
