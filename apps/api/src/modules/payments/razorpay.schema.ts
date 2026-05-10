import { z } from 'zod'

export const createRazorpayOrderBody = z
  .object({
    purpose: z.enum([
      'WALLET_RECHARGE',
      'COD_SETTLEMENT',
      'SUBSCRIPTION',
      'SHIPMENT_FEE',
    ]),
    amountPaise: z.coerce.number().int().positive().max(5_000_000_00).optional(),
    orderPublicId: z.string().min(1).optional(),
    planCode: z.enum(['BASIC', 'PRO', 'ENTERPRISE']).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.purpose === 'WALLET_RECHARGE' || data.purpose === 'COD_SETTLEMENT') {
      if (data.amountPaise == null) {
        ctx.addIssue({
          code: 'custom',
          message: 'amountPaise is required for this purpose',
          path: ['amountPaise'],
        })
      }
    }
    if (data.purpose === 'SUBSCRIPTION') {
      if (!data.planCode) {
        ctx.addIssue({
          code: 'custom',
          message: 'planCode is required for SUBSCRIPTION',
          path: ['planCode'],
        })
      }
    }
    if (data.purpose === 'SHIPMENT_FEE') {
      if (!data.orderPublicId) {
        ctx.addIssue({
          code: 'custom',
          message: 'orderPublicId is required for SHIPMENT_FEE',
          path: ['orderPublicId'],
        })
      }
    }
  })

export const verifyRazorpayPaymentBody = z.object({
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
})

export type CreateRazorpayOrderInput = z.infer<typeof createRazorpayOrderBody>
export type VerifyRazorpayPaymentInput = z.infer<typeof verifyRazorpayPaymentBody>
