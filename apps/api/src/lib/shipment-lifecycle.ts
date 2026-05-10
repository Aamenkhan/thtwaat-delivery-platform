import { OrderStatus } from '@prisma/client'

/** External / partner tracking states (PAN-India + RTO naming). */
export type PanIndiaLifecycle =
  | 'ORDER_CREATED'
  | 'PICKUP_ASSIGNED'
  | 'PICKED_UP'
  | 'AT_SOURCE_HUB'
  | 'IN_TRANSIT'
  | 'AT_DESTINATION_HUB'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'RTO_INITIATED'
  | 'RTO_DELIVERED'

export function orderStatusToLifecycle(status: OrderStatus): PanIndiaLifecycle {
  const map: Record<OrderStatus, PanIndiaLifecycle> = {
    [OrderStatus.CREATED]: 'ORDER_CREATED',
    [OrderStatus.PICKUP_ASSIGNED]: 'PICKUP_ASSIGNED',
    [OrderStatus.PICKED_UP]: 'PICKED_UP',
    [OrderStatus.AT_SOURCE_HUB]: 'AT_SOURCE_HUB',
    [OrderStatus.IN_TRANSIT]: 'IN_TRANSIT',
    [OrderStatus.AT_DESTINATION_HUB]: 'AT_DESTINATION_HUB',
    [OrderStatus.OUT_FOR_DELIVERY]: 'OUT_FOR_DELIVERY',
    [OrderStatus.DELIVERED]: 'DELIVERED',
    [OrderStatus.RETURN_REQUESTED]: 'RTO_INITIATED',
    [OrderStatus.RETURN_PICKED]: 'RTO_INITIATED',
    [OrderStatus.RETURN_IN_TRANSIT]: 'RTO_INITIATED',
    [OrderStatus.RETURN_COMPLETED]: 'RTO_DELIVERED',
    [OrderStatus.CANCELLED]: 'ORDER_CREATED',
  }
  return map[status] ?? 'ORDER_CREATED'
}
