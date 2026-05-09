import { Hono } from 'hono'
import { z } from 'zod'
import { prisma } from '../../lib/db.js'
import { jsonError, jsonOk } from '../../lib/http.js'
import { publicApiKeyMiddleware } from '../../middleware/public-api-key.js'

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const lat1 = (a.lat * Math.PI) / 180
  const lat2 = (b.lat * Math.PI) / 180
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(x))
}

const quoteBody = z.object({
  origin: z.object({ lat: z.number(), lng: z.number() }),
  destination: z.object({ lat: z.number(), lng: z.number() }),
  weightKg: z.number().positive().optional(),
})

export const pricingRoutes = new Hono()

pricingRoutes.use('/*', publicApiKeyMiddleware)

pricingRoutes.post('/quote', async (c) => {
  const parsed = quoteBody.safeParse(await c.req.json())
  if (!parsed.success) {
    return jsonError(c, 'validation_error', 'Invalid body', 422, parsed.error)
  }

  const rules = await prisma.priceRule.findMany({ where: { active: true } })
  const dest = parsed.data.destination

  const match =
    rules.find((r) => {
      if (r.minLat == null || r.maxLat == null || r.minLng == null || r.maxLng == null) {
        return false
      }
      return (
        dest.lat >= r.minLat &&
        dest.lat <= r.maxLat &&
        dest.lng >= r.minLng &&
        dest.lng <= r.maxLng
      )
    }) ?? rules[0]

  const distanceKm = haversineKm(parsed.data.origin, parsed.data.destination)
  const perKm = match?.perKmCents ?? 50
  const base = match?.baseCents ?? 500
  const weightFactor = parsed.data.weightKg
    ? Math.round(parsed.data.weightKg * 100)
    : 0

  const amountCents = base + Math.round(distanceKm * perKm) + weightFactor

  return jsonOk(c, {
    quote: {
      currency: 'USD',
      amountCents,
      ruleId: match?.id ?? null,
      distanceKm: Math.round(distanceKm * 100) / 100,
    },
  })
})

pricingRoutes.post('/rules', async (c) => {
  const body = z
    .object({
      name: z.string().min(1),
      regionCode: z.string().optional(),
      minLat: z.number().optional(),
      maxLat: z.number().optional(),
      minLng: z.number().optional(),
      maxLng: z.number().optional(),
      baseCents: z.number().int().nonnegative(),
      perKmCents: z.number().int().nonnegative().optional(),
    })
    .safeParse(await c.req.json())

  if (!body.success) {
    return jsonError(c, 'validation_error', 'Invalid body', 422, body.error)
  }

  const rule = await prisma.priceRule.create({ data: body.data })
  return jsonOk(c, { rule })
})
