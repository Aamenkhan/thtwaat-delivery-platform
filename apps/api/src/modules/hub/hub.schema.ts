import { z } from 'zod'

export const createHubBody = z.object({
  name: z.string().min(1),
  city: z.string().optional(),
  code: z.string().optional(),
  latitude: z.number(),
  longitude: z.number(),
  address: z.string().optional(),
})

export const zoneBody = z.object({
  zoneGeo: z.record(z.string(), z.unknown()),
})

export const nearestBody = z.object({
  lat: z.number(),
  lng: z.number(),
})

export const assignRouteBody = z.object({
  orderId: z.string().min(1),
  fromHubId: z.string().min(1),
  toHubId: z.string().min(1),
})
