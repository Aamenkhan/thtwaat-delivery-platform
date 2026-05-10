import { OrderType } from '@prisma/client'
import { prisma } from '../../lib/prisma.js'
import * as orderService from '../order/order.service.js'
import { wooFetchJson } from './woocommerce.service.js'

type ShipmentPayload = { storeId: string; orderId: string; status: string }
type ImportPayload = { storeId: string; page?: number }

export async function syncShipment(payload: ShipmentPayload) {
  const store = await prisma.connectedStore.findUnique({
    where: { id: payload.storeId },
  })
  if (!store) throw new Error('Store missing')
  const creds = store.credentialsJson as {
    consumerKey?: string
    consumerSecret?: string
  } | null
  if (
    !creds?.consumerKey ||
    !creds?.consumerSecret ||
    !store.externalId.startsWith('http')
  ) {
    throw new Error('Woo credentials or site URL missing')
  }
  const link = await prisma.ecommerceOrderLink.findFirst({
    where: { orderId: payload.orderId, storeId: payload.storeId },
  })
  if (!link) {
    console.log('[woo job] no ecommerce link for shipment sync', payload)
    return
  }
  console.log('[woo job] shipment sync — extend with wc/v3/orders/:id', {
    externalOrderId: link.externalOrderId,
    status: payload.status,
  })
}

export async function importOrders(payload: ImportPayload) {
  const store = await prisma.connectedStore.findUnique({
    where: { id: payload.storeId },
  })
  if (!store) throw new Error('Store missing')

  const page = payload.page ?? 1
  const raw = await wooFetchJson(payload.storeId, 'orders', {
    page: String(page),
    per_page: '20',
    status: 'processing',
  })
  const orders = raw as Array<{
    id: number
    shipping?: Record<string, string | undefined>
  }>

  for (const o of orders) {
    const externalOrderId = String(o.id)
    const exists = await prisma.ecommerceOrderLink.findUnique({
      where: {
        storeId_externalOrderId: {
          storeId: store.id,
          externalOrderId,
        },
      },
    })
    if (exists) continue

    const ship = o.shipping
    const address = [ship?.address_1, ship?.city, ship?.postcode, ship?.country]
      .filter(Boolean)
      .join(', ')

    const order = await orderService.createOrderAsSeller(store.sellerId, {
      orderType: OrderType.LOCAL_DELIVERY,
      destination: {
        address: address || `Woo order ${externalOrderId}`,
        lat: 0,
        lng: 0,
      },
    })

    await prisma.ecommerceOrderLink.create({
      data: {
        orderId: order.id,
        storeId: store.id,
        externalOrderId,
        externalOrderNumber: externalOrderId,
      },
    })
  }

  await prisma.connectedStore.update({
    where: { id: store.id },
    data: {
      lastSyncAt: new Date(),
      lastSyncStatus: 'SYNCED',
      syncCursor: String(page),
    },
  })
}
