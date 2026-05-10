import { prisma } from '../lib/prisma.js'
import { domainEvents } from '../lib/events.js'
import { platformEventsForTransition } from '../lib/webhooks/platform-events.js'
import { dispatchPlatformWebhook } from '../lib/webhooks/platform-dispatch.js'

let registered = false

export function registerOrderWebhookBridge() {
  if (registered) return
  registered = true

  domainEvents.on('order:status:changed', (p) => {
    void (async () => {
      const order = await prisma.order.findUnique({ where: { id: p.orderId } })
      if (!order) return
      const events = platformEventsForTransition(p.from, p.to)
      for (const event of events) {
        await dispatchPlatformWebhook({
          event,
          orderId: order.id,
          publicId: order.publicId,
          sellerId: order.sellerId,
          status: order.status,
        })
      }
    })().catch(console.error)
  })

  domainEvents.on('order:tracking:updated', (p) => {
    void (async () => {
      const order = await prisma.order.findUnique({
        where: { id: p.orderId },
        include: { shipment: true },
      })
      if (!order) return
      await dispatchPlatformWebhook({
        event: 'shipment.updated',
        orderId: order.id,
        publicId: order.publicId,
        sellerId: order.sellerId,
        status: order.status,
        payload: {
          trackingKind: p.kind,
          eventKey: p.eventKey,
          trackingNumber: order.shipment?.trackingNumber ?? null,
          trackingPublicId: order.shipment?.trackingPublicId ?? null,
        },
      })
    })().catch(console.error)
  })
}
