import { OrderStatus, ScanEvent } from '@prisma/client'
import { HttpError } from '../lib/http-error.js'

/** Resolve next order status after a scan event (undefined = audit-only, no status change). */
export function nextStatusAfterScan(
  current: OrderStatus,
  event: ScanEvent
): OrderStatus | undefined {
  if (
    event === ScanEvent.SELLER_CONFIRM ||
    event === ScanEvent.OTP_VERIFY ||
    event === ScanEvent.BOOKING_RECEIVED
  ) {
    return undefined
  }

  const map: Partial<
    Record<OrderStatus, Partial<Record<ScanEvent, OrderStatus>>>
  > = {
    [OrderStatus.CREATED]: {
      [ScanEvent.PICKUP_SCAN]: OrderStatus.PICKED_UP,
    },
    [OrderStatus.PICKUP_ASSIGNED]: {
      [ScanEvent.PICKUP_SCAN]: OrderStatus.PICKED_UP,
    },
    [OrderStatus.PICKED_UP]: {
      [ScanEvent.HUB_DROP_SCAN]: OrderStatus.AT_SOURCE_HUB,
    },
    [OrderStatus.AT_SOURCE_HUB]: {
      [ScanEvent.HUB_ACCEPT]: OrderStatus.IN_TRANSIT,
    },
    [OrderStatus.IN_TRANSIT]: {
      [ScanEvent.HUB_ACCEPT]: OrderStatus.AT_DESTINATION_HUB,
    },
    [OrderStatus.AT_DESTINATION_HUB]: {
      [ScanEvent.DELIVERY_SCAN]: OrderStatus.OUT_FOR_DELIVERY,
    },
    [OrderStatus.OUT_FOR_DELIVERY]: {
      [ScanEvent.DELIVERED]: OrderStatus.DELIVERED,
    },
    [OrderStatus.DELIVERED]: {
      [ScanEvent.RETURN_INIT]: OrderStatus.RETURN_REQUESTED,
    },
    [OrderStatus.RETURN_REQUESTED]: {
      [ScanEvent.RETURN_SCAN]: OrderStatus.RETURN_PICKED,
    },
    [OrderStatus.RETURN_PICKED]: {
      [ScanEvent.RETURN_HUB_ACCEPT]: OrderStatus.RETURN_IN_TRANSIT,
    },
    [OrderStatus.RETURN_IN_TRANSIT]: {
      [ScanEvent.RETURN_HUB_ACCEPT]: OrderStatus.RETURN_COMPLETED,
    },
  }

  return map[current]?.[event]
}

/**
 * Strict scan rules:
 * - DELIVERY_SCAN only after parcel is at destination hub (AT_DESTINATION_HUB).
 * - RETURN_SCAN only after RETURN_INIT (RETURN_REQUESTED).
 */
export function assertScanAllowed(
  current: OrderStatus,
  event: ScanEvent
) {
  if (event === ScanEvent.DELIVERY_SCAN) {
    if (current !== OrderStatus.AT_DESTINATION_HUB) {
      throw new HttpError(
        400,
        'DELIVERY_SCAN requires AT_DESTINATION_HUB (destination hub must accept inbound first)'
      )
    }
    return
  }

  if (event === ScanEvent.RETURN_SCAN) {
    if (current !== OrderStatus.RETURN_REQUESTED) {
      throw new HttpError(
        400,
        'RETURN_SCAN requires RETURN_REQUESTED (RETURN_INIT must be recorded first)'
      )
    }
    return
  }

  if (event === ScanEvent.BOOKING_RECEIVED) {
    if (current !== OrderStatus.CREATED) {
      throw new HttpError(400, 'BOOKING_RECEIVED only valid in CREATED')
    }
    return
  }

  if (event === ScanEvent.SELLER_CONFIRM) {
    if (
      current !== OrderStatus.CREATED &&
      current !== OrderStatus.PICKED_UP &&
      current !== OrderStatus.PICKUP_ASSIGNED
    ) {
      throw new HttpError(
        400,
        'SELLER_CONFIRM only from CREATED, PICKUP_ASSIGNED, or PICKED_UP'
      )
    }
    return
  }
  if (event === ScanEvent.OTP_VERIFY) {
    if (current !== OrderStatus.OUT_FOR_DELIVERY) {
      throw new HttpError(400, 'OTP_VERIFY scan only when OUT_FOR_DELIVERY')
    }
    return
  }

  if (event === ScanEvent.PICKUP_SCAN) {
    if (
      current !== OrderStatus.CREATED &&
      current !== OrderStatus.PICKUP_ASSIGNED
    ) {
      throw new HttpError(
        400,
        'PICKUP_SCAN only from CREATED or PICKUP_ASSIGNED'
      )
    }
    return
  }

  const next = nextStatusAfterScan(current, event)
  if (!next) {
    throw new HttpError(
      400,
      `Scan ${event} is not valid after status ${current}`
    )
  }
}
