import type { RequestHandler } from 'express'
import type { z } from 'zod'
import { listWindowQuery } from './admin-logistics.schema.js'
import * as svc from './admin-logistics.service.js'

export const summary: RequestHandler = async (_req, res, next) => {
  try {
    const data = await svc.getLogisticsSummary()
    res.json({ ok: true, data })
  } catch (e) {
    next(e)
  }
}

export const sellers: RequestHandler = async (req, res, next) => {
  try {
    const q = req.query as unknown as z.infer<typeof listWindowQuery>
    const data = await svc.listSellersForAdmin({
      limit: q.limit ?? 50,
      offset: q.offset ?? 0,
    })
    res.json({ ok: true, data })
  } catch (e) {
    next(e)
  }
}

export const pricingSlabs: RequestHandler = async (_req, res, next) => {
  try {
    const slabs = await svc.listIndiaPricingSlabs()
    res.json({ ok: true, data: { slabs } })
  } catch (e) {
    next(e)
  }
}

export const hubZones: RequestHandler = async (_req, res, next) => {
  try {
    const zones = await svc.listHubZonesForAdmin()
    res.json({ ok: true, data: { zones } })
  } catch (e) {
    next(e)
  }
}

export const codOrders: RequestHandler = async (req, res, next) => {
  try {
    const q = req.query as unknown as z.infer<typeof listWindowQuery>
    const data = await svc.listCodOrdersForAdmin({
      limit: q.limit ?? 50,
      offset: q.offset ?? 0,
    })
    res.json({ ok: true, data })
  } catch (e) {
    next(e)
  }
}

export const analytics: RequestHandler = async (_req, res, next) => {
  try {
    const data = await svc.getAdminNetworkAnalytics()
    res.json({ ok: true, data })
  } catch (e) {
    next(e)
  }
}
