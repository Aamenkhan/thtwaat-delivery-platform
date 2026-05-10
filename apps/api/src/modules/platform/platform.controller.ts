import type { RequestHandler } from 'express'
import {
  requirePrimarySellerFromRequest,
  requireSellerFromRequest,
} from '../../lib/seller-context.js'
import { prisma } from '../../lib/prisma.js'
import { newApiKeyRaw, hashApiKey } from '../../lib/api-key-crypto.js'
import { HttpError } from '../../lib/http-error.js'

export const createApiKey: RequestHandler = async (req, res, next) => {
  try {
    const seller = await requirePrimarySellerFromRequest(req)
    const raw = newApiKeyRaw()
    const keyHash = hashApiKey(raw)
    const row = await prisma.apiKey.create({
      data: {
        sellerId: seller.id,
        keyHash,
        label: req.body.label,
        scopes: req.body.scopes?.length ? req.body.scopes : ['orders:read'],
        rateLimitPerMinute: req.body.rateLimitPerMinute ?? 120,
      },
    })
    res.status(201).json({
      ok: true,
      data: {
        id: row.id,
        label: row.label,
        scopes: row.scopes,
        rateLimitPerMinute: row.rateLimitPerMinute,
        /** Show once — store securely. */
        secret: raw,
      },
    })
  } catch (e) {
    next(e)
  }
}

export const listApiKeys: RequestHandler = async (req, res, next) => {
  try {
    const seller = await requireSellerFromRequest(req)
    const keys = await prisma.apiKey.findMany({
      where: { sellerId: seller.id },
      select: {
        id: true,
        label: true,
        scopes: true,
        rateLimitPerMinute: true,
        active: true,
        lastUsedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    })
    res.json({ ok: true, data: { apiKeys: keys } })
  } catch (e) {
    next(e)
  }
}

export const createWebhook: RequestHandler = async (req, res, next) => {
  try {
    const seller = await requireSellerFromRequest(req)
    const sub = await prisma.sellerWebhookSubscription.create({
      data: {
        sellerId: seller.id,
        url: req.body.url,
        secret: req.body.secret,
        events: req.body.events,
      },
    })
    res.status(201).json({ ok: true, data: { subscription: sub } })
  } catch (e) {
    next(e)
  }
}

export const listWebhooks: RequestHandler = async (req, res, next) => {
  try {
    const seller = await requireSellerFromRequest(req)
    const subs = await prisma.sellerWebhookSubscription.findMany({
      where: { sellerId: seller.id },
      orderBy: { createdAt: 'desc' },
    })
    res.json({
      ok: true,
      data: {
        subscriptions: subs.map((sub) => ({
          ...sub,
          secret: '[redacted]',
        })),
      },
    })
  } catch (e) {
    next(e)
  }
}

export const revokeApiKey: RequestHandler = async (req, res, next) => {
  try {
    const seller = await requireSellerFromRequest(req)
    const id = req.params.id
    if (!id) throw new HttpError(400, 'id required')
    const updated = await prisma.apiKey.updateMany({
      where: { id, sellerId: seller.id },
      data: { active: false },
    })
    if (updated.count === 0) throw new HttpError(404, 'API key not found')
    res.json({ ok: true, data: { revoked: true } })
  } catch (e) {
    next(e)
  }
}
