import type { RequestHandler } from 'express'
import { buildPublicTrackPayload } from '../order/order-track-aggregate.service.js'

export const getPublicOrderAggregate: RequestHandler = async (req, res, next) => {
  try {
    const ref = req.params.orderNumber!
    const data = await buildPublicTrackPayload(ref)
    res.json({ ok: true, data })
  } catch (e) {
    next(e)
  }
}
