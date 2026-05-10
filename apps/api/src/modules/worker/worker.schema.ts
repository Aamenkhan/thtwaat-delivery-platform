import { z } from 'zod'
import { WorkerRole } from '@prisma/client'

export const createWorkerBody = z.object({
  displayName: z.string().min(1),
  phone: z.string().optional(),
  role: z.nativeEnum(WorkerRole).default(WorkerRole.COURIER),
  userId: z.string().optional(),
})

export const earningBody = z.object({
  amountCents: z.number().int(),
  kind: z.string().min(1),
  orderId: z.string().optional(),
  note: z.string().optional(),
})

export const workerGpsPingBody = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracyMeters: z.number().positive().optional(),
})
