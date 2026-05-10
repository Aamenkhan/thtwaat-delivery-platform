import { z } from 'zod'

export const requestOtpBody = z.object({
  phone: z.string().min(5),
  purpose: z.string().min(1),
  orderId: z.string().optional(),
})

export const verifyOtpBody = z.object({
  phone: z.string().min(5),
  code: z.string().min(4).max(12),
  purpose: z.string().min(1),
  orderId: z.string().optional(),
  /** Required when purpose is DELIVERY_COMPLETION (creates ScanLog + marks DELIVERED). */
  workerId: z.string().optional(),
  qrCode: z.string().optional(),
  photoUrl: z.string().url().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
})
