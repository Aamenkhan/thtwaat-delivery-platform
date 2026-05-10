import { z } from 'zod'

export const ndrCreateBody = z.object({
  reasonCode: z.string().min(1).max(80),
  notes: z.string().max(2000).optional(),
  nextAttemptAt: z.string().datetime().optional(),
})

export const exceptionCreateBody = z.object({
  code: z.string().min(1).max(80),
  note: z.string().max(2000).optional(),
})

export const payoutRequestBody = z.object({
  /** Amount in major INR units (rupees). */
  amountRupees: z.number().positive().max(50_000_000),
})
