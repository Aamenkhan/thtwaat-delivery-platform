import { OrderType } from '@prisma/client'
import { prisma } from '../../lib/prisma.js'
import { distanceKm } from '../../lib/geo.js'
import type { quoteBody } from './pricing.schema.js'
import type { z } from 'zod'

function inZone(
  lat: number,
  lng: number,
  row: {
    minLat: number | null
    maxLat: number | null
    minLng: number | null
    maxLng: number | null
  }
) {
  if (
    row.minLat != null &&
    row.maxLat != null &&
    row.minLng != null &&
    row.maxLng != null
  ) {
    return (
      lat >= row.minLat &&
      lat <= row.maxLat &&
      lng >= row.minLng &&
      lng <= row.maxLng
    )
  }
  return false
}

export async function quote(input: z.infer<typeof quoteBody>) {
  const distance = distanceKm(input.origin, input.destination)

  const hubs = input.hubId
    ? await prisma.hub.findMany({ where: { id: input.hubId } })
    : await prisma.hub.findMany()

  let best:
    | (typeof hubs)[0]
    | undefined
  let bestRule: Awaited<
    ReturnType<typeof prisma.hubZonePricing.findMany>
  >[0] | null = null

  for (const hub of hubs) {
    const rules = await prisma.hubZonePricing.findMany({
      where: {
        hubId: hub.id,
        active: true,
        OR: [{ orderType: input.orderType }, { orderType: null }],
      },
    })
    const dest = input.destination
    const match =
      rules.find((r) => inZone(dest.lat, dest.lng, r)) ?? rules[0]
    if (match) {
      best = hub
      bestRule = match
      break
    }
  }

  if (!bestRule) {
    const localBase =
      input.orderType === OrderType.LOCAL_DELIVERY ? 12_000 : 500 + distance * 80
    return {
      currency: 'INR',
      amountCents: Math.round(localBase),
      distanceKm: Math.round(distance * 100) / 100,
      breakdown: {
        mode: 'mvp_local_flat',
        orderType: input.orderType,
        note:
          input.orderType === OrderType.LOCAL_DELIVERY
            ? 'Default hyperlocal ₹120 (stored as paise in amountCents)'
            : undefined,
      },
    }
  }

  let amount =
    bestRule.baseCents + Math.round(distance * (bestRule.perKmCents ?? 80))

  if (input.orderType === OrderType.BUS_PARCEL) {
    const m = bestRule.busParcelMultiplier ?? 1
    amount = Math.round(amount * m)
  }

  if (input.orderType === OrderType.TRUCKLOAD) {
    const flat = bestRule.truckloadFlatCents ?? 25_000
    const perKg = input.weightKg ? Math.round(input.weightKg * 50) : 0
    const pallets = input.palletCount ? input.palletCount * 5_000 : 0
    amount = flat + perKg + pallets
  }

  return {
    currency: 'INR',
    amountCents: amount,
    distanceKm: Math.round(distance * 100) / 100,
    hubId: best?.id ?? null,
    zoneCode: bestRule.zoneCode,
    breakdown: {
      baseCents: bestRule.baseCents,
      perKmCents: bestRule.perKmCents,
      orderType: input.orderType,
      customerPaysPaise: amount,
    },
  }
}
