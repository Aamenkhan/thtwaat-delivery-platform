import { OrderType } from '@prisma/client'
import { z } from 'zod'

export const sellerWebOrderTypeEnum = z.enum(['LOCAL_DELIVERY', 'BUS_PARCEL'])

export const sellerWebCreateOrderBody = z
  .object({
    customerId: z.string().min(1).optional(),
    customerName: z.string().min(1).max(200).optional(),
    customerPhone: z.string().min(8).max(20).optional(),
    productName: z.string().min(1).max(200),
    /** Weight in kilograms (seller UI may collect grams and divide by 1000). */
    productWeight: z.number().positive(),
    /** Declared value in INR major units (stored as COD amount for pricing). */
    productValue: z.number().nonnegative(),
    deliveryAddress: z.string().min(1).max(500),
    deliveryLat: z.number().min(-90).max(90),
    deliveryLng: z.number().min(-180).max(180),
    deliveryPincode: z.string().length(6),
    pickupAddress: z.string().min(1).max(500),
    pickupLat: z.number().min(-90).max(90).optional(),
    pickupLng: z.number().min(-180).max(180).optional(),
    pickupPincode: z.string().length(6),
    orderType: sellerWebOrderTypeEnum,
  })
  .superRefine((d, ctx) => {
    const hasCustomer =
      (d.customerId != null && d.customerId.length > 0) ||
      (Boolean(d.customerName?.trim()) && Boolean(d.customerPhone?.trim()))
    if (!hasCustomer) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide customerId or both customerName and customerPhone',
      })
    }
  })

export function prismaOrderTypeFromSellerWeb(
  t: z.infer<typeof sellerWebOrderTypeEnum>
): OrderType {
  return t === 'BUS_PARCEL' ? OrderType.BUS_PARCEL : OrderType.LOCAL_DELIVERY
}
