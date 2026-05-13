import { z } from 'zod'
import { OrderStatus, OrderType } from '@prisma/client'

export const createOrderBody = z.object({
  sellerId: z.string().optional(),
  customerId: z.string().optional(),
  orderType: z.nativeEnum(OrderType).default(OrderType.LOCAL_DELIVERY),
  destination: z.object({
    address: z.string().optional(),
    lat: z.number(),
    lng: z.number(),
  }),
  /** When `deliveryCity` is omitted, API may fill city/state from this pincode. */
  deliveryPincode: z.string().length(6).optional(),
  deliveryCity: z.string().optional(),
  deliveryState: z.string().optional(),
})

export const assignSourceHubBody = z.object({
  hubId: z.string().min(1),
})

export const returnOrderBody = z.object({
  reason: z.string().optional(),
})

export const patchStatusBody = z.object({
  status: z.nativeEnum(OrderStatus),
})
