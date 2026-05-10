import { z } from 'zod'
import { OrderType } from '@prisma/client'

export const quoteBody = z.object({
  orderType: z.nativeEnum(OrderType),
  origin: z.object({ lat: z.number(), lng: z.number() }),
  destination: z.object({ lat: z.number(), lng: z.number() }),
  hubId: z.string().optional(),
  weightKg: z.number().positive().optional(),
  palletCount: z.number().int().positive().optional(),
})
