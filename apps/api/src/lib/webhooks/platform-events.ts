import { OrderStatus } from '@prisma/client'

export type PlatformWebhookEvent =
  | 'order.created'
  | 'order.picked'
  | 'order.in_transit'
  | 'order.delivered'
  | 'order.returned'
  | 'shipment.updated'
  | 'wallet.credited'
  | 'ndr.created'
  | 'exception.reported'

export function platformEventsForTransition(
  from: OrderStatus,
  to: OrderStatus
): PlatformWebhookEvent[] {
  if (from === to) return []
  const out: PlatformWebhookEvent[] = []
  if (to === OrderStatus.PICKED_UP) out.push('order.picked')
  if (to === OrderStatus.IN_TRANSIT) out.push('order.in_transit')
  if (to === OrderStatus.DELIVERED) out.push('order.delivered')
  if (to === OrderStatus.RETURN_COMPLETED) out.push('order.returned')
  return out
}
