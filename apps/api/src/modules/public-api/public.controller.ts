import type { RequestHandler } from 'express'
import { HttpError } from '../../lib/http-error.js'
import * as orderService from '../order/order.service.js'
import { OrderType } from '@prisma/client'

export const getOrder: RequestHandler = async (req, res, next) => {
  try {
    if (!req.apiKeyAuth) throw new HttpError(401, 'Unauthorized')
    const order = await orderService.getByPublicId(req.params.publicId!)
    if (order.sellerId !== req.apiKeyAuth.sellerId) {
      throw new HttpError(404, 'Order not found')
    }
    res.json({ ok: true, data: { order } })
  } catch (e) {
    next(e)
  }
}

export const createOrder: RequestHandler = async (req, res, next) => {
  try {
    if (!req.apiKeyAuth) throw new HttpError(401, 'Unauthorized')
    const body = req.body as {
      orderType?: OrderType
      customerId?: string
      destination: { address: string; lat?: number; lng?: number }
    }
    const order = await orderService.createOrderAsSeller(req.apiKeyAuth.sellerId, {
      orderType: body.orderType ?? OrderType.LOCAL_DELIVERY,
      customerId: body.customerId,
      destination: {
        address: body.destination.address,
        lat: body.destination.lat ?? 0,
        lng: body.destination.lng ?? 0,
      },
    })
    res.status(201).json({ ok: true, data: { order } })
  } catch (e) {
    next(e)
  }
}
