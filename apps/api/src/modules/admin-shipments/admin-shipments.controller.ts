import type { RequestHandler } from 'express'
import type { z } from 'zod'
import { adminListShipmentsQuery } from '../shipment/shipment.schema.js'
import * as svc from './admin-shipments.service.js'

export const list: RequestHandler = async (req, res, next) => {
  try {
    const q = req.query as unknown as z.infer<typeof adminListShipmentsQuery>
    const data = await svc.adminListShipments({
      status: q.status,
      sellerId: q.sellerId,
      limit: q.limit ?? 50,
      offset: q.offset ?? 0,
    })
    res.json({ ok: true, data })
  } catch (e) {
    next(e)
  }
}

export const getOne: RequestHandler = async (req, res, next) => {
  try {
    const order = await svc.adminGetShipment(req.params.ref!)
    res.json({ ok: true, data: { order } })
  } catch (e) {
    next(e)
  }
}

export const timeline: RequestHandler = async (req, res, next) => {
  try {
    const data = await svc.adminShipmentTimeline(req.params.publicId!)
    res.json({ ok: true, data })
  } catch (e) {
    next(e)
  }
}

export const assign: RequestHandler = async (req, res, next) => {
  try {
    const order = await svc.adminAssignShipment(req.params.publicId!, req.body)
    res.json({ ok: true, data: { order } })
  } catch (e) {
    next(e)
  }
}
