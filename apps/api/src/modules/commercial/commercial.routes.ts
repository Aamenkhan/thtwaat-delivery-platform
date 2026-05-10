import { Router, type Request } from 'express'
import { requireApiKey } from '../../middleware/api-key.js'
import { apiKeyRateLimiter } from '../../middleware/api-key-rate-limit.js'
import { validateBody } from '../../middleware/validate.js'
import { HttpError } from '../../lib/http-error.js'
import * as commercial from './commercial.service.js'
import * as walletSvc from '../../lib/seller-wallet.service.js'
import {
  exceptionCreateBody,
  ndrCreateBody,
  payoutRequestBody,
} from './commercial.schema.js'

const r = Router()

function sellerId(req: Request) {
  if (!req.apiKeyAuth) throw new HttpError(401, 'Unauthorized')
  return req.apiKeyAuth.sellerId
}

/** Prefixed `seller/` so routes do not collide with `GET /orders/:id`. */
r.get(
  '/seller/wallet',
  requireApiKey('wallet:read'),
  apiKeyRateLimiter(),
  async (req, res, next) => {
    try {
      const w = await walletSvc.getWalletSnapshot(sellerId(req))
      const ledger = await walletSvc.listWalletLedger(sellerId(req), 40)
      res.json({ ok: true, data: { wallet: w, ledger } })
    } catch (e) {
      next(e)
    }
  }
)

r.get(
  '/seller/payouts',
  requireApiKey('wallet:read'),
  apiKeyRateLimiter(),
  async (req, res, next) => {
    try {
      const rows = await walletSvc.listPayoutsForSeller(sellerId(req), 50)
      res.json({ ok: true, data: { payouts: rows } })
    } catch (e) {
      next(e)
    }
  }
)

r.post(
  '/seller/payouts',
  requireApiKey('wallet:write'),
  apiKeyRateLimiter(),
  validateBody(payoutRequestBody),
  async (req, res, next) => {
    try {
      const rupees = req.body.amountRupees as number
      const payout = await walletSvc.requestPayoutDebit(
        sellerId(req),
        Math.round(rupees * 100)
      )
      res.status(201).json({ ok: true, data: { payout } })
    } catch (e) {
      next(e)
    }
  }
)

r.get(
  '/seller/analytics/summary',
  requireApiKey('analytics:read'),
  apiKeyRateLimiter(),
  async (req, res, next) => {
    try {
      const summary = await commercial.analyticsSummary(sellerId(req))
      res.json({ ok: true, data: { summary } })
    } catch (e) {
      next(e)
    }
  }
)

r.get(
  '/seller/integrations/overview',
  requireApiKey('orders:read'),
  apiKeyRateLimiter(),
  async (req, res, next) => {
    try {
      const overview = await commercial.integrationsOverview(sellerId(req))
      res.json({ ok: true, data: { overview } })
    } catch (e) {
      next(e)
    }
  }
)

r.post(
  '/seller/orders/:publicId/ndr',
  requireApiKey('orders:write'),
  apiKeyRateLimiter(),
  validateBody(ndrCreateBody),
  async (req, res, next) => {
    try {
      const row = await commercial.createNdr(
        sellerId(req),
        req.params.publicId!,
        req.body
      )
      res.status(201).json({ ok: true, data: { ndr: row } })
    } catch (e) {
      next(e)
    }
  }
)

r.get(
  '/seller/orders/:publicId/ndr',
  requireApiKey('orders:read'),
  apiKeyRateLimiter(),
  async (req, res, next) => {
    try {
      const rows = await commercial.listNdr(sellerId(req), req.params.publicId!)
      res.json({ ok: true, data: { ndrAttempts: rows } })
    } catch (e) {
      next(e)
    }
  }
)

r.post(
  '/seller/orders/:publicId/exceptions',
  requireApiKey('orders:write'),
  apiKeyRateLimiter(),
  validateBody(exceptionCreateBody),
  async (req, res, next) => {
    try {
      const row = await commercial.createException(
        sellerId(req),
        req.params.publicId!,
        req.body
      )
      res.status(201).json({ ok: true, data: { exception: row } })
    } catch (e) {
      next(e)
    }
  }
)

r.get(
  '/seller/orders/:publicId/exceptions',
  requireApiKey('orders:read'),
  apiKeyRateLimiter(),
  async (req, res, next) => {
    try {
      const rows = await commercial.listExceptions(
        sellerId(req),
        req.params.publicId!
      )
      res.json({ ok: true, data: { exceptions: rows } })
    } catch (e) {
      next(e)
    }
  }
)

r.patch(
  '/seller/orders/:publicId/exceptions/:exceptionId/resolve',
  requireApiKey('orders:write'),
  apiKeyRateLimiter(),
  async (req, res, next) => {
    try {
      const row = await commercial.resolveException(
        sellerId(req),
        req.params.publicId!,
        req.params.exceptionId!
      )
      res.json({ ok: true, data: { exception: row } })
    } catch (e) {
      next(e)
    }
  }
)

export const commercialPartnerRouter = r
