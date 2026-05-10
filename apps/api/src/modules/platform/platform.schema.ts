import { z } from 'zod'

export const createApiKeyBody = z.object({
  label: z.string().min(1).max(120),
  scopes: z.array(z.string()).default([]),
  rateLimitPerMinute: z.number().int().min(10).max(10_000).optional(),
})

export const createWebhookSubBody = z.object({
  url: z.string().url(),
  secret: z.string().min(8).max(256),
  events: z
    .array(
      z.enum([
        'order.created',
        'order.picked',
        'order.in_transit',
        'order.delivered',
        'order.returned',
        'shipment.updated',
        'wallet.credited',
        'ndr.created',
        'exception.reported',
      ])
    )
    .min(1),
})
