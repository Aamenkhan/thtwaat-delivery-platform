import { OrderStatus } from '@prisma/client'
import { prisma } from '../../lib/prisma.js'
import { HttpError } from '../../lib/http-error.js'
import { dispatchPlatformWebhook } from '../../lib/webhooks/platform-dispatch.js'
import { domainEvents } from '../../lib/events.js'
import { runBookShipment } from './order-booking.engine.js'
import { bookSellerShipmentBody } from './shipment.schema.js'
import type { z } from 'zod'

export async function bookSellerShipment(
  sellerId: string,
  body: z.infer<typeof bookSellerShipmentBody>
) {
  const seller = await prisma.seller.findUnique({ where: { id: sellerId } })
  if (!seller) throw new HttpError(404, 'Seller not found')

  const input = {
    ...body,
    sellerId,
  }

  const result = await runBookShipment(input, {
    channel: 'POST /v1/seller/shipments',
    structuredPickup: body.structuredPickup,
    structuredDelivery: body.structuredDelivery,
  })

  void dispatchPlatformWebhook({
    event: 'order.created',
    orderId: result.order.id,
    publicId: result.order.publicId,
    sellerId: result.order.sellerId,
    status: result.order.status,
  }).catch(console.error)

  domainEvents.emit('order:tracking:updated', {
    orderId: result.order.id,
    publicId: result.order.publicId,
    kind: 'booking',
    eventKey: 'order.created',
  })

  const { hub, routePlan, pricingBreakdown, weightGrams, codAmountCents } =
    result

  return {
    order: result.order,
    shipment: result.shipment,
    summary: {
      publicId: result.order.publicId,
      trackingId: result.shipment.trackingPublicId,
      trackingNumber: result.shipment.trackingNumber,
      qrCode: result.order.qrCode,
      status: result.order.status,
      estimatedDeliveryAt: result.order.estimatedDeliveryAt,
      hub: {
        id: hub.id,
        name: hub.name,
        code: hub.code,
        city: hub.city,
        state: hub.state,
        hubType: hub.hubType,
      },
      destinationHubId: routePlan?.destinationHubId ?? hub.id,
      routing: routePlan,
      pricingBreakdown: {
        ...pricingBreakdown,
        codAmountCents,
        weightGrams,
      },
    },
  }
}

export async function listSellerShipments(
  sellerId: string,
  opts: { status?: string; limit: number; page: number }
) {
  const where: { sellerId: string; status?: OrderStatus } = { sellerId }
  if (opts.status) {
    const match = (Object.values(OrderStatus) as string[]).find(
      (s) => s === opts.status
    )
    if (match) where.status = match as OrderStatus
  }
  const skip = (opts.page - 1) * opts.limit
  const shipments = await prisma.order.findMany({
    where,
    take: opts.limit,
    skip,
    orderBy: { createdAt: 'desc' },
    include: {
      shipment: true,
      customer: { select: { fullName: true, phone: true } },
      sourceHub: { select: { name: true, code: true } },
    },
  })
  return { shipments, page: opts.page, limit: opts.limit }
}

export async function getSellerShipment(sellerId: string, ref: string) {
  const order = await prisma.order.findFirst({
    where: {
      sellerId,
      OR: [{ publicId: ref }, { id: ref }, { qrCode: ref }],
    },
    include: {
      shipment: true,
      customer: true,
      sourceHub: true,
      destinationHub: true,
      pickupLocation: true,
      deliveryLocation: true,
      assignedWorker: { select: { id: true, displayName: true, phone: true } },
      pickupWorker: { select: { id: true, displayName: true, phone: true } },
    },
  })
  if (!order) throw new HttpError(404, 'Shipment not found')
  return order
}

export async function qrPayloadForOrder(publicId: string, sellerId: string) {
  const order = await prisma.order.findFirst({
    where: { publicId, sellerId },
    include: { shipment: true },
  })
  if (!order) throw new HttpError(404, 'Shipment not found')
  const base =
    process.env.PUBLIC_APP_URL?.replace(/\/$/, '') ??
    process.env.PUBLIC_TRACKING_BASE_URL?.replace(/\/$/, '') ??
    process.env.RENDER_EXTERNAL_URL?.replace(/\/$/, '') ??
    'http://localhost:4000'
  const tid = order.shipment?.trackingPublicId ?? order.publicId
  return {
    /** Value to encode in QR — resolves to public JSON timeline. */
    payload: `${base}/v1/tracking/public/${tid}/timeline`,
    qrCode: order.qrCode,
    trackingPublicId: order.shipment?.trackingPublicId ?? null,
    trackingNumber: order.shipment?.trackingNumber ?? null,
  }
}
