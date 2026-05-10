import { prisma } from '../../lib/prisma.js'
import { HttpError } from '../../lib/http-error.js'
import { dispatchPlatformWebhook } from '../../lib/webhooks/platform-dispatch.js'
import { runBookShipment } from '../shipment/order-booking.engine.js'
import * as trackingService from '../tracking/tracking.service.js'
import type { createPartnerOrderBody } from './api-orders.schema.js'
import type { z } from 'zod'
import { domainEvents } from '../../lib/events.js'

export async function createPartnerOrder(
  input: z.infer<typeof createPartnerOrderBody>,
  apiSellerId: string
) {
  if (input.sellerId !== apiSellerId) {
    throw new HttpError(403, 'sellerId must match the authenticated API key seller')
  }

  const seller = await prisma.seller.findUnique({ where: { id: input.sellerId } })
  if (!seller) throw new HttpError(404, 'Seller not found')

  const result = await runBookShipment(input, {
    channel: 'POST /api/v1/orders',
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
    orderId: result.order.publicId,
    internalOrderId: result.order.id,
    trackingId: result.shipment.trackingPublicId,
    trackingNumber: result.shipment.trackingNumber,
    qrCode: result.order.qrCode,
    hubAssigned: {
      id: hub.id,
      name: hub.name,
      code: hub.code,
      city: hub.city,
      state: hub.state,
      hubType: hub.hubType,
    },
    destinationHubId: routePlan?.destinationHubId ?? hub.id,
    routing: routePlan,
    estimatedDelivery: result.order.estimatedDeliveryAt!.toISOString(),
    pricingBreakdown: {
      ...pricingBreakdown,
      codAmountCents,
      weightGrams,
    },
  }
}

export async function getTrackingForPartner(
  trackingId: string,
  sellerId: string
) {
  const ship = await prisma.shipment.findUnique({
    where: { trackingPublicId: trackingId },
    include: { order: true },
  })
  if (!ship?.order || ship.order.sellerId !== sellerId) {
    throw new HttpError(404, 'Tracking not found')
  }
  return trackingService.timelineByPublicId(ship.order.publicId)
}

export async function getOrderForPartner(id: string, sellerId: string) {
  const order = await prisma.order.findFirst({
    where: {
      sellerId,
      OR: [{ id }, { publicId: id }],
    },
    include: {
      customer: true,
      sourceHub: true,
      shipment: true,
      pickupLocation: true,
      deliveryLocation: true,
      scanLogs: { orderBy: { scannedAt: 'asc' }, include: { worker: true, hub: true } },
      trackingEvents: { orderBy: { createdAt: 'asc' } },
    },
  })
  if (!order) throw new HttpError(404, 'Order not found')
  return order
}
