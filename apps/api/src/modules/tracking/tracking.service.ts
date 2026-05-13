import { prisma } from '../../lib/prisma.js'
import { HttpError } from '../../lib/http-error.js'
import { orderStatusToLifecycle } from '../../lib/shipment-lifecycle.js'

export async function timelineByPublicId(publicId: string) {
  const order = await prisma.order.findUnique({
    where: { publicId },
    include: {
      customer: true,
      shipment: true,
      scanLogs: {
        orderBy: { scannedAt: 'asc' },
        include: { worker: true, hub: true },
      },
      trackingEvents: { orderBy: { createdAt: 'asc' } },
    },
  })
  if (!order) throw new HttpError(404, 'Order not found')

  const scanEvents = order.scanLogs.map((s) => ({
    id: s.id,
    kind: 'scan' as const,
    event: s.event,
    qrCode: s.qrCode,
    workerId: s.workerId,
    workerName: s.worker?.displayName ?? 'System',
    photoUrl: s.photoUrl,
    latitude: s.latitude,
    longitude: s.longitude,
    scannedAt: s.scannedAt,
    hubId: s.hubId,
    hubName: s.hub?.name ?? null,
    metadata: s.metadata,
  }))

  const platformEvents = order.trackingEvents.map((t) => ({
    id: t.id,
    kind: 'platform' as const,
    eventKey: t.eventKey,
    source: t.source,
    payload: t.payload,
    scannedAt: t.createdAt,
  }))

  const timeline = [...scanEvents, ...platformEvents].sort(
    (a, b) =>
      new Date(a.scannedAt).getTime() - new Date(b.scannedAt).getTime()
  )

  return {
    order: {
      publicId: order.publicId,
      status: order.status,
      lifecycle: orderStatusToLifecycle(order.status),
      qrCode: order.qrCode,
      trackingId: order.shipment?.trackingPublicId ?? null,
      trackingNumber: order.shipment?.trackingNumber ?? null,
      estimatedDeliveryAt: order.estimatedDeliveryAt?.toISOString() ?? null,
      parcelType: order.parcelType,
      codAmountCents: order.codAmountCents,
      customer: order.customer
        ? {
            fullName: order.customer.fullName,
            phone: order.customer.phone,
            email: order.customer.email,
          }
        : null,
    },
    timeline,
  }
}

export async function timelineByTrackingPublicId(trackingPublicId: string) {
  const ship = await prisma.shipment.findUnique({
    where: { trackingPublicId },
    include: { order: true },
  })
  if (!ship?.order) throw new HttpError(404, 'Tracking id not found')
  return timelineByPublicId(ship.order.publicId)
}

/** Public tracking: CUID `trackingPublicId` or branded `trackingNumber` (TW-…), or `Order.publicId`. */
export async function timelineByTrackingRef(ref: string) {
  const byPublic = await prisma.shipment.findUnique({
    where: { trackingPublicId: ref },
    include: { order: true },
  })
  if (byPublic?.order) return timelineByPublicId(byPublic.order.publicId)

  const byNum = await prisma.shipment.findFirst({
    where: { trackingNumber: ref },
    include: { order: true },
  })
  if (byNum?.order) return timelineByPublicId(byNum.order.publicId)

  const byOrderPublic = await prisma.order.findUnique({
    where: { publicId: ref },
    select: { publicId: true },
  })
  if (byOrderPublic) return timelineByPublicId(byOrderPublic.publicId)

  throw new HttpError(404, 'Tracking id not found')
}
