import { z } from 'zod'
import { createPartnerOrderBody } from '../api-orders/api-orders.schema.js'

export const structuredAddressSchema = z.object({
  label: z.string().max(120).optional(),
  line1: z.string().min(1).max(500),
  line2: z.string().max(500).optional(),
  city: z.string().max(120).optional(),
  state: z.string().max(120).optional(),
  postalCode: z.string().max(20).optional(),
  country: z.string().max(8).optional().default('IN'),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  contactName: z.string().max(200).optional(),
  contactPhone: z.string().max(20).optional(),
})

export const bookSellerShipmentBody = createPartnerOrderBody
  .omit({ sellerId: true })
  .extend({
    structuredPickup: structuredAddressSchema.optional(),
    structuredDelivery: structuredAddressSchema.optional(),
  })

export const listSellerShipmentsQuery = z.object({
  status: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(30),
  page: z.coerce.number().int().min(1).optional().default(1),
})

export const adminListShipmentsQuery = z.object({
  status: z.string().optional(),
  sellerId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
})

export const adminAssignShipmentBody = z.object({
  pickupWorkerId: z.string().min(1).nullable().optional(),
  assignedWorkerId: z.string().min(1).nullable().optional(),
})
