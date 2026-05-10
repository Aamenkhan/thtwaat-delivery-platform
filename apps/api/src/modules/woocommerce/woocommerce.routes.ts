import { Router } from 'express'
import { z } from 'zod'
import { requireAuth, requireRole } from '../../middleware/auth.js'
import { Role } from '@prisma/client'
import { validateBody } from '../../middleware/validate.js'
import { requireSellerFromRequest } from '../../lib/seller-context.js'
import { upsertWooStore } from './woocommerce.service.js'
import { enqueueJob } from '../../lib/queue/integration-jobs.js'
import { prisma } from '../../lib/prisma.js'
import { HttpError } from '../../lib/http-error.js'

const connectBody = z.object({
  siteUrl: z.string().url(),
  consumerKey: z.string().min(3),
  consumerSecret: z.string().min(3),
})

const syncBody = z.object({
  storeId: z.string().min(1),
  page: z.number().int().min(1).optional(),
})

const r = Router()

r.post(
  '/connect',
  requireAuth,
  requireRole(Role.SELLER, Role.HUB_MANAGER),
  validateBody(connectBody),
  async (req, res, next) => {
    try {
      const seller = await requireSellerFromRequest(req)
      const store = await upsertWooStore({
        sellerId: seller.id,
        siteUrl: req.body.siteUrl,
        consumerKey: req.body.consumerKey,
        consumerSecret: req.body.consumerSecret,
      })
      res.status(201).json({ ok: true, data: { store } })
    } catch (e) {
      next(e)
    }
  }
)

r.post(
  '/sync/orders',
  requireAuth,
  requireRole(Role.SELLER, Role.HUB_MANAGER),
  validateBody(syncBody),
  async (req, res, next) => {
    try {
      const seller = await requireSellerFromRequest(req)
      const store = await prisma.connectedStore.findFirst({
        where: { id: req.body.storeId, sellerId: seller.id },
      })
      if (!store) {
        throw new HttpError(404, 'Store not found')
      }
      await enqueueJob({
        type: 'WOOCOMMERCE_IMPORT_ORDERS',
        payload: { storeId: store.id, page: req.body.page ?? 1 },
        sellerId: seller.id,
        storeId: store.id,
      })
      res.json({ ok: true, data: { enqueued: true } })
    } catch (e) {
      next(e)
    }
  }
)

export const wooCommerceRouter = r
