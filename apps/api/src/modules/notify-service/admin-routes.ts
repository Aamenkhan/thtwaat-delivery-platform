import { Hono } from 'hono'
import { z } from 'zod'
import { prisma } from '../../lib/db.js'
import { hashApiKey, newApiKeyRaw } from '../../lib/crypto.js'
import { jsonError, jsonOk } from '../../lib/http.js'

const mintBody = z.object({
  label: z.string().min(1),
  sellerId: z.string().optional(),
  hubId: z.string().optional(),
  scopes: z.array(z.string()).default(['*']),
})

/**
 * Bootstrap-only: mint public API keys. Guard with `ADMIN_BOOTSTRAP_TOKEN`.
 */
export const notifyAdminRoutes = new Hono()

notifyAdminRoutes.post('/api-keys', async (c) => {
  const token = c.req.header('x-admin-token')
  if (!token || token !== process.env.ADMIN_BOOTSTRAP_TOKEN) {
    return jsonError(c, 'unauthorized', 'Invalid admin token', 401)
  }

  const parsed = mintBody.safeParse(await c.req.json())
  if (!parsed.success) {
    return jsonError(c, 'validation_error', 'Invalid body', 422, parsed.error)
  }

  const raw = newApiKeyRaw()
  const row = await prisma.apiKey.create({
    data: {
      keyHash: hashApiKey(raw),
      label: parsed.data.label,
      sellerId: parsed.data.sellerId,
      hubId: parsed.data.hubId,
      scopes: parsed.data.scopes,
    },
  })

  return jsonOk(
    c,
    {
      apiKey: {
        id: row.id,
        label: row.label,
        secret: raw,
        sellerId: row.sellerId,
        hubId: row.hubId,
        scopes: row.scopes,
      },
    },
    201
  )
})
