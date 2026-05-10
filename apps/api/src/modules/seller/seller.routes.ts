import { Router } from 'express'
import { requireAuth, requireRole } from '../../middleware/auth.js'
import { Role } from '@prisma/client'
import { requireSellerFromRequest } from '../../lib/seller-context.js'
import { validateBody, validateQuery } from '../../middleware/validate.js'
import {
  bookSellerShipmentBody,
  listSellerShipmentsQuery,
} from '../shipment/shipment.schema.js'
import { payoutRequestBody } from '../commercial/commercial.schema.js'
import * as shipmentCtrl from '../shipment/shipment.controller.js'
import * as sellerService from './seller.service.js'
import * as walletSvc from '../../lib/seller-wallet.service.js'

const r = Router()

r.use(requireAuth, requireRole(Role.SELLER, Role.HUB_MANAGER))

r.post(
  '/shipments',
  validateBody(bookSellerShipmentBody),
  shipmentCtrl.book
)
r.get(
  '/shipments',
  validateQuery(listSellerShipmentsQuery),
  shipmentCtrl.list
)
r.get('/shipments/:publicId/qr.svg', shipmentCtrl.qrSvg)
r.get('/shipments/:publicId/qr', shipmentCtrl.qrMeta)
r.get('/shipments/:publicId', shipmentCtrl.getOne)

r.get('/dashboard/summary', async (req, res, next) => {
  try {
    const seller = await requireSellerFromRequest(req)
    const summary = await sellerService.getDashboardSummary(seller.id)
    res.json({ ok: true, data: { summary } })
  } catch (e) {
    next(e)
  }
})

r.get('/integrations/stores', async (req, res, next) => {
  try {
    const seller = await requireSellerFromRequest(req)
    const stores = await sellerService.listConnectedStores(seller.id)
    res.json({ ok: true, data: { stores } })
  } catch (e) {
    next(e)
  }
})

r.get('/integrations/jobs', async (req, res, next) => {
  try {
    const seller = await requireSellerFromRequest(req)
    const limit = Math.min(
      100,
      Math.max(1, Number(req.query.limit) || 30)
    )
    const jobs = await sellerService.listRecentIntegrationJobs(seller.id, limit)
    res.json({ ok: true, data: { jobs } })
  } catch (e) {
    next(e)
  }
})

r.get('/analytics/shipments', async (req, res, next) => {
  try {
    const seller = await requireSellerFromRequest(req)
    const summary = await sellerService.getDashboardSummary(seller.id)
    res.json({
      ok: true,
      data: {
        shipmentsByStatusLast30d: summary.shipmentsByStatusLast30d,
        openOrders: summary.openOrders,
        deliveredThisWeek: summary.deliveredThisWeek,
      },
    })
  } catch (e) {
    next(e)
  }
})

r.get('/wallet', async (req, res, next) => {
  try {
    const seller = await requireSellerFromRequest(req)
    const wallet = await walletSvc.getWalletSnapshot(seller.id)
    const ledger = await walletSvc.listWalletLedger(seller.id, 60)
    res.json({ ok: true, data: { wallet, ledger } })
  } catch (e) {
    next(e)
  }
})

r.get('/payouts', async (req, res, next) => {
  try {
    const seller = await requireSellerFromRequest(req)
    const payouts = await walletSvc.listPayoutsForSeller(seller.id, 80)
    res.json({ ok: true, data: { payouts } })
  } catch (e) {
    next(e)
  }
})

r.post(
  '/payouts',
  validateBody(payoutRequestBody),
  async (req, res, next) => {
    try {
      const seller = await requireSellerFromRequest(req)
      const rupees = req.body.amountRupees as number
      const payout = await walletSvc.requestPayoutDebit(
        seller.id,
        Math.round(rupees * 100)
      )
      res.status(201).json({ ok: true, data: { payout } })
    } catch (e) {
      next(e)
    }
  }
)

export const sellerRouter = r
