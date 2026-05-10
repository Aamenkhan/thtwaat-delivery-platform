import { OrderStatus, StoreProvider } from '@prisma/client'
import { domainEvents } from '../lib/events.js'
import { prisma } from '../lib/prisma.js'
import { enqueueJob } from '../lib/queue/integration-jobs.js'

let registered = false

export function registerEcommerceJobBridge() {
  if (registered) return
  registered = true

  domainEvents.on('order:status:changed', (p) => {
    void (async () => {
      const links = await prisma.ecommerceOrderLink.findMany({
        where: { orderId: p.orderId },
        include: { store: true },
      })
      for (const link of links) {
        const store = link.store
        if (store.provider === StoreProvider.SHOPIFY) {
          if (
            p.to === OrderStatus.IN_TRANSIT ||
            p.to === OrderStatus.OUT_FOR_DELIVERY ||
            p.to === OrderStatus.DELIVERED
          ) {
            await enqueueJob({
              type: 'SHOPIFY_PUSH_TRACKING',
              payload: {
                storeId: store.id,
                orderPublicId: p.publicId,
                trackingNumber: p.publicId,
              },
              sellerId: store.sellerId,
              storeId: store.id,
            })
          }
          if (p.to === OrderStatus.RETURN_COMPLETED) {
            await enqueueJob({
              type: 'SHOPIFY_RETURN_SYNC',
              payload: {
                storeId: store.id,
                externalOrderId: link.externalOrderId,
              },
              sellerId: store.sellerId,
              storeId: store.id,
            })
          }
        }
        if (store.provider === StoreProvider.WOOCOMMERCE) {
          await enqueueJob({
            type: 'WOOCOMMERCE_SHIPMENT_SYNC',
            payload: {
              storeId: store.id,
              orderId: p.orderId,
              status: p.to,
            },
            sellerId: store.sellerId,
            storeId: store.id,
          })
        }
      }
    })().catch(console.error)
  })
}
