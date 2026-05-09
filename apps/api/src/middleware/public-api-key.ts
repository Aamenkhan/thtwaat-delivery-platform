import type { MiddlewareHandler } from 'hono'
import { prisma } from '../lib/db.js'
import { hashApiKey } from '../lib/crypto.js'
import { jsonError } from '../lib/http.js'

/**
 * Validates `Authorization: Bearer pk_...` against stored ApiKey rows.
 * Attaches `apiKeyId` and optional `sellerId` / `hubId` to context.
 */
export const publicApiKeyMiddleware: MiddlewareHandler = async (c, next) => {
  const header = c.req.header('authorization')
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) {
    return jsonError(c, 'unauthorized', 'Missing bearer token', 401)
  }

  const keyHash = hashApiKey(token)
  const row = await prisma.apiKey.findUnique({ where: { keyHash } })
  if (!row) {
    return jsonError(c, 'unauthorized', 'Invalid API key', 401)
  }

  await prisma.apiKey.update({
    where: { id: row.id },
    data: { lastUsedAt: new Date() },
  })

  c.set('apiKey', {
    id: row.id,
    sellerId: row.sellerId,
    hubId: row.hubId,
    scopes: row.scopes,
  })

  return next()
}
