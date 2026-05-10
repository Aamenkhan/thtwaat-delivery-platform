import type { RequestHandler } from 'express'
import { HttpError } from '../../lib/http-error.js'
import * as svc from './api-orders.service.js'

export const createOrder: RequestHandler = async (req, res, next) => {
  try {
    if (!req.apiKeyAuth) throw new HttpError(401, 'Unauthorized')
    const data = await svc.createPartnerOrder(req.body, req.apiKeyAuth.sellerId)
    res.status(201).json({ ok: true, data })
  } catch (e) {
    next(e)
  }
}

export const getOrder: RequestHandler = async (req, res, next) => {
  try {
    if (!req.apiKeyAuth) throw new HttpError(401, 'Unauthorized')
    const order = await svc.getOrderForPartner(
      req.params.id!,
      req.apiKeyAuth.sellerId
    )
    res.json({ ok: true, data: { order } })
  } catch (e) {
    next(e)
  }
}

export const trackingByTrackingId: RequestHandler = async (req, res, next) => {
  try {
    if (!req.apiKeyAuth) throw new HttpError(401, 'Unauthorized')
    const data = await svc.getTrackingForPartner(
      req.params.trackingId!,
      req.apiKeyAuth.sellerId
    )
    res.json({ ok: true, data })
  } catch (e) {
    next(e)
  }
}
