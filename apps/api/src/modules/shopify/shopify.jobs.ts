import { prisma } from '../../lib/prisma.js'

type TrackingPayload = { storeId: string; orderPublicId: string; trackingNumber: string }
type ReturnPayload = { storeId: string; externalOrderId: string }

/** Push tracking to Shopify Admin API (extend with real fulfillment IDs). */
export async function pushTracking(payload: TrackingPayload) {
  const store = await prisma.connectedStore.findUnique({
    where: { id: payload.storeId },
  })
  if (!store?.accessToken) throw new Error('Store not connected')
  const shop = store.externalId
  const url = `https://${shop}/admin/api/2024-01/orders.json?name=${encodeURIComponent(payload.orderPublicId)}`
  const res = await fetch(url, {
    headers: {
      'X-Shopify-Access-Token': store.accessToken,
      'Content-Type': 'application/json',
    },
  })
  if (!res.ok) {
    throw new Error(`Shopify orders lookup failed: ${res.status}`)
  }
  // Production: create fulfillment with tracking_number via GraphQL or REST
  console.log('[shopify job] tracking queued for', payload)
}

export async function syncReturn(_payload: ReturnPayload) {
  // Production: create refund or return in Shopify from logistics return state
  console.log('[shopify job] return sync stub', _payload)
}
