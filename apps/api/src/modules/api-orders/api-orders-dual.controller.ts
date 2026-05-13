import type { NextFunction, Request, RequestHandler, Response } from 'express'
import { Role } from '@prisma/client'
import QRCode from 'qrcode'
import { verifyAccessToken } from '../../lib/jwt.js'
import { HttpError } from '../../lib/http-error.js'
import { prisma } from '../../lib/prisma.js'
import { requireSellerFromRequest } from '../../lib/seller-context.js'
import { requireApiKey } from '../../middleware/api-key.js'
import { apiKeyRateLimiter } from '../../middleware/api-key-rate-limit.js'
import { validateBody } from '../../middleware/validate.js'
import * as svc from './api-orders.service.js'
import { createPartnerOrderBody } from './api-orders.schema.js'
import {
  prismaOrderTypeFromSellerWeb,
  sellerWebCreateOrderBody,
} from './seller-web-order.schema.js'
import * as shipmentService from '../shipment/shipment.service.js'
import { bookSellerShipmentBody } from '../shipment/shipment.schema.js'
import { sendCustomerBookingOtp } from '../shipment/booking-otp.service.js'

function runWaterfall(
  req: Request,
  res: Response,
  handlers: RequestHandler[]
): Promise<void> {
  return new Promise((resolve, reject) => {
    let i = 0
    const next: NextFunction = (err?: unknown) => {
      if (err) {
        reject(err)
        return
      }
      if (i >= handlers.length) {
        resolve()
        return
      }
      const fn = handlers[i++]!
      try {
        void fn(req, res, next)
      } catch (e) {
        reject(e)
      }
    }
    next()
  })
}

function trySellerAuth(req: Request) {
  const header = req.headers.authorization
  const headerToken = header?.startsWith('Bearer ') ? header.slice(7) : null
  const cookieTok = req.cookies?.thtwaat_access_token as string | undefined
  const token = cookieTok || headerToken
  if (!token) return null
  try {
    const p = verifyAccessToken(token)
    return {
      userId: p.sub,
      role: p.role,
      orgId: p.orgId,
      membershipRole: p.membershipRole,
    }
  } catch {
    return null
  }
}

async function attachBookingOtpAndQr(
  sellerId: string,
  data: Awaited<ReturnType<typeof shipmentService.bookSellerShipment>>,
  customerPhone: string
) {
  const otpOut = await sendCustomerBookingOtp({
    orderId: data.order.id,
    phone: customerPhone,
  })
  const { payload } = await shipmentService.qrPayloadForOrder(
    data.order.publicId,
    sellerId
  )
  const qrDataUrl = await QRCode.toDataURL(payload, { margin: 1, width: 256 })
  return {
    ...data,
    qrDataUrl,
    otpSentMaskedPhone: otpOut.maskedPhone,
    otpConfirmationMessage: `OTP sent to customer: ${otpOut.maskedPhone}`,
  }
}

export const postApiV1Orders: RequestHandler = async (req, res, next) => {
  try {
    const rawKey = req.headers['x-api-key']
    if (typeof rawKey === 'string' && rawKey.trim()) {
      await runWaterfall(req, res, [
        requireApiKey('orders:write'),
        apiKeyRateLimiter(),
        validateBody(createPartnerOrderBody),
      ])
      const data = await svc.createPartnerOrder(
        req.body,
        req.apiKeyAuth!.sellerId
      )
      res.status(201).json({ ok: true, data })
      return
    }

    const auth = trySellerAuth(req)
    if (!auth) {
      throw new HttpError(401, 'Missing X-Api-Key or seller session')
    }
    if (auth.role !== Role.SELLER && auth.role !== Role.HUB_MANAGER) {
      throw new HttpError(403, 'Seller session required for this endpoint')
    }

    req.auth = {
      userId: auth.userId,
      role: auth.role,
      orgId: auth.orgId,
      membershipRole: auth.membershipRole,
    }
    const seller = await requireSellerFromRequest(req)

    const isSellerWebShape =
      req.body &&
      typeof req.body === 'object' &&
      'productName' in req.body &&
      typeof (req.body as { productName?: unknown }).productName === 'string'

    if (isSellerWebShape) {
      const parsed = sellerWebCreateOrderBody.safeParse(req.body)
      if (!parsed.success) {
        throw new HttpError(422, 'Validation failed', parsed.error.flatten())
      }
      const b = parsed.data
      let customerName: string
      let customerPhone: string
      if (b.customerId) {
        const c = await prisma.customer.findUnique({
          where: { id: b.customerId },
        })
        if (!c) throw new HttpError(404, 'Customer not found')
        customerName = c.fullName
        customerPhone = c.phone.replace(/\s+/g, '')
      } else {
        customerName = b.customerName!.trim()
        customerPhone = b.customerPhone!.replace(/\s+/g, '')
      }

      const bookBody = {
        customerName,
        customerPhone,
        pickupAddress: b.pickupAddress,
        pickupLat: b.pickupLat,
        pickupLng: b.pickupLng,
        deliveryAddress: b.deliveryAddress,
        deliveryLat: b.deliveryLat,
        deliveryLng: b.deliveryLng,
        parcelType: 'PARCEL' as const,
        weight: { kg: b.productWeight },
        codAmount: b.productValue,
        pickupPincode: b.pickupPincode,
        deliveryPincode: b.deliveryPincode,
        orderType: prismaOrderTypeFromSellerWeb(b.orderType),
      }

      const data = await shipmentService.bookSellerShipment(seller.id, bookBody)

      await prisma.orderItem.create({
        data: {
          orderId: data.order.id,
          title: b.productName,
          quantity: 1,
          weightGrams: Math.round(b.productWeight * 1000),
          valueCents: Math.round(b.productValue * 100),
        },
      })

      const enriched = await attachBookingOtpAndQr(
        seller.id,
        data,
        customerPhone
      )
      res.status(201).json({ ok: true, data: enriched })
      return
    }

    const legacy = bookSellerShipmentBody.safeParse(req.body)
    if (!legacy.success) {
      throw new HttpError(422, 'Validation failed', legacy.error.flatten())
    }
    const data = await shipmentService.bookSellerShipment(
      seller.id,
      legacy.data
    )
    const enriched = await attachBookingOtpAndQr(
      seller.id,
      data,
      legacy.data.customerPhone
    )
    res.status(201).json({ ok: true, data: enriched })
  } catch (e) {
    next(e)
  }
}
