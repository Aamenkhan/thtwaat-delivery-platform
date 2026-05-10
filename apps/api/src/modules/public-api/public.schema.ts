import { z } from 'zod'
import { OrderType } from '@prisma/client'

export const publicCreateOrderBody = z.object({
  orderType: z.nativeEnum(OrderType).optional(),
  customerId: z.string().optional(),
  destination: z.object({
    address: z.string().min(1),
    lat: z.number().optional(),
    lng: z.number().optional(),
  }),
})
