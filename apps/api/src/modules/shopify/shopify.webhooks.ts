import type { ConnectedStore } from '@prisma/client'
import { OrderType } from '@prisma/client'
import { prisma } from '../../lib/prisma.js'
import { enqueueJob } from '../../lib/queue/integration-jobs.js'
import * as orderService from '../order/order.service.js'

type ShopifyOrderPayload = {
  id?: number
  order_number?: number
  shipping_address?: {
    address1?: string
    city?: string
    country?: string
    zip?: string
  }
}

export async function handleShopifyWebhookTopic(
  topic: string,
  store: ConnectedStore,
  rawJson: string
) {
  const payload = JSON.parse(rawJson) as ShopifyOrderPayload

  if (topic === 'orders/create' || topic === 'orders/paid') {
    await ensureShipmentFromOrder(store, payload)
    return
  }

  if (topic === 'refunds/create') {
    const orderId = (payload as { order_id?: number }).order_id
    if (orderId == null) return
    await enqueueJob({
      type: 'SHOPIFY_RETURN_SYNC',
      payload: { storeId: store.id, externalOrderId: String(orderId) },
      sellerId: store.sellerId,
      storeId: store.id,
    })
  }
}

async function ensureShipmentFromOrder(
  store: ConnectedStore,
  body: ShopifyOrderPayload
) {
  if (body.id == null) return
  const externalOrderId = String(body.id)
  const existing = await prisma.ecommerceOrderLink.findUnique({
    where: {
      storeId_externalOrderId: { storeId: store.id, externalOrderId },
    },
  })
  if (existing) return

  const dest = body.shipping_address
  const address = [dest?.address1, dest?.city, dest?.country, dest?.zip]
    .filter(Boolean)
    .join(', ')

  const order = await orderService.createOrderAsSeller(store.sellerId, {
    orderType: OrderType.LOCAL_DELIVERY,
    destination: {
      address: address || 'Shopify order',
      lat: 0,
      lng: 0,
    },
  })

  await prisma.ecommerceOrderLink.create({
    data: {
      orderId: order.id,
      storeId: store.id,
      externalOrderId,
      externalOrderNumber:
        body.order_number != null ? String(body.order_number) : null,
    },
  })
}
