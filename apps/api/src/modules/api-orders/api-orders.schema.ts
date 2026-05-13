import { OrderType } from '@prisma/client'
import { z } from 'zod'

export const parcelTypeEnum = z.enum([
  'DOCUMENT',
  'PARCEL',
  'FOOD',
  'FRAGILE',
  'OTHER',
])

export const createPartnerOrderBody = z.object({
  sellerId: z.string().min(1),
  customerName: z.string().min(1).max(200),
  customerPhone: z
    .string()
    .min(8)
    .max(20)
    .transform((s) => s.replace(/\s+/g, '')),
  pickupAddress: z.string().min(1).max(500),
  pickupLat: z.number().min(-90).max(90).optional(),
  pickupLng: z.number().min(-180).max(180).optional(),
  deliveryAddress: z.string().min(1).max(500),
  deliveryLat: z.number().min(-90).max(90),
  deliveryLng: z.number().min(-180).max(180),
  parcelType: parcelTypeEnum,
  weight: z
    .object({
      kg: z.number().nonnegative().optional(),
      grams: z.number().int().nonnegative().optional(),
    })
    .refine((w) => w.kg != null || w.grams != null, {
      message: 'Provide weight.kg and/or weight.grams',
    }),
  dimensions: z
    .object({
      lengthCm: z.number().positive(),
      widthCm: z.number().positive(),
      heightCm: z.number().positive(),
    })
    .optional(),
  /** COD in major currency units (INR rupees); stored as paise on the order. */
  codAmount: z.number().nonnegative(),
  /** When set with deliveryPincode, uses PAN-India pincode directory + inter-hub routes. */
  pickupPincode: z.string().length(6).optional(),
  deliveryPincode: z.string().length(6).optional(),
  /** Express uses higher multipliers on India pricing engine. */
  express: z.boolean().optional(),
  /** When set, overrides `mapParcelToOrderType` (e.g. BUS_PARCEL for inter-city). */
  orderType: z.nativeEnum(OrderType).optional(),
})
