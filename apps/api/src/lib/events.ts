import { EventEmitter } from 'node:events'
import type { OrderStatus } from '@prisma/client'

export type OrderStatusChangedPayload = {
  orderId: string
  publicId: string
  from: OrderStatus
  to: OrderStatus
}

export type OrderTrackingUpdatedPayload = {
  orderId: string
  publicId: string
  kind: string
  eventKey?: string
}

/** Shipment successfully booked (order + shipment persisted). */
export type OrderBookedPayload = {
  orderId: string
  publicId: string
}

/** Internal domain bus for side effects (webhooks, analytics, projections). */
export const domainEvents = new EventEmitter()
domainEvents.setMaxListeners(50)
