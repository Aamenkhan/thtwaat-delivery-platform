import type { RequestHandler } from 'express'
import QRCode from 'qrcode'
import type { z } from 'zod'
import { requireSellerFromRequest } from '../../lib/seller-context.js'
import * as shipmentService from './shipment.service.js'
import { listSellerShipmentsQuery } from './shipment.schema.js'

export const book: RequestHandler = async (req, res, next) => {
  try {
    const seller = await requireSellerFromRequest(req)
    const data = await shipmentService.bookSellerShipment(seller.id, req.body)
    res.status(201).json({ ok: true, data })
  } catch (e) {
    next(e)
  }
}

export const list: RequestHandler = async (req, res, next) => {
  try {
    const seller = await requireSellerFromRequest(req)
    const q = req.query as unknown as z.infer<typeof listSellerShipmentsQuery>
    const data = await shipmentService.listSellerShipments(seller.id, {
      status: q.status,
      limit: q.limit ?? 30,
      page: q.page ?? 1,
    })
    res.json({ ok: true, data })
  } catch (e) {
    next(e)
  }
}

export const getOne: RequestHandler = async (req, res, next) => {
  try {
    const seller = await requireSellerFromRequest(req)
    const order = await shipmentService.getSellerShipment(
      seller.id,
      req.params.publicId!
    )
    res.json({ ok: true, data: { order } })
  } catch (e) {
    next(e)
  }
}

export const qrSvg: RequestHandler = async (req, res, next) => {
  try {
    const seller = await requireSellerFromRequest(req)
    const { payload } = await shipmentService.qrPayloadForOrder(
      req.params.publicId!,
      seller.id
    )
    const svg = await QRCode.toString(payload, { type: 'svg', margin: 1 })
    res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8')
    res.setHeader('Cache-Control', 'private, max-age=60')
    res.send(svg)
  } catch (e) {
    next(e)
  }
}

export const qrMeta: RequestHandler = async (req, res, next) => {
  try {
    const seller = await requireSellerFromRequest(req)
    const data = await shipmentService.qrPayloadForOrder(
      req.params.publicId!,
      seller.id
    )
    res.json({ ok: true, data })
  } catch (e) {
    next(e)
  }
}
