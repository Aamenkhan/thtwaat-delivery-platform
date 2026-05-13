import { OrderType, type Hub, type Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma.js'
import { HttpError } from '../../lib/http-error.js'
import { distanceKm } from '../../lib/geo.js'
import type {
  createHubBody,
  zoneBody,
  nearestBody,
  assignRouteBody,
} from './hub.schema.js'
import type { z } from 'zod'

export async function createHub(input: z.infer<typeof createHubBody>) {
  return prisma.hub.create({ data: input })
}

export async function listHubs() {
  return prisma.hub.findMany({
    orderBy: { name: 'asc' },
    include: {
      hubProfile: { select: { isActive: true } },
    },
  })
}

export async function updateZone(hubId: string, input: z.infer<typeof zoneBody>) {
  const hub = await prisma.hub.findUnique({ where: { id: hubId } })
  if (!hub) throw new HttpError(404, 'Hub not found')
  return prisma.hub.update({
    where: { id: hubId },
    data: { zoneGeo: input.zoneGeo as Prisma.InputJsonValue },
  })
}

export async function nearestHub(input: z.infer<typeof nearestBody>) {
  const hubs = await prisma.hub.findMany()
  if (!hubs.length) return { hub: null as null, distanceKm: null as null }

  let best = hubs[0]!
  let bestD = distanceKm(
    { lat: input.lat, lng: input.lng },
    { lat: best.latitude, lng: best.longitude }
  )
  for (const h of hubs.slice(1)) {
    const d = distanceKm(
      { lat: input.lat, lng: input.lng },
      { lat: h.latitude, lng: h.longitude }
    )
    if (d < bestD) {
      best = h
      bestD = d
    }
  }
  return { hub: best, distanceKm: Math.round(bestD * 1000) / 1000 }
}

/**
 * When pincode is not in the directory or coords are missing, still assign a hub
 * (nearest by coordinates, city name match, or first hub).
 */
export async function resolveHubWithPincodeFallback(input: {
  deliveryLat?: number | null
  deliveryLng?: number | null
  pickupLat?: number | null
  pickupLng?: number | null
  deliveryCity?: string | null
  pickupCity?: string | null
}): Promise<{ hub: Hub; distanceKm: number | null; reason: string }> {
  const hubs = await prisma.hub.findMany({ orderBy: { createdAt: 'asc' } })
  if (!hubs.length) {
    throw new HttpError(400, 'No hub configured; seed a hub before creating orders')
  }

  const lat = input.pickupLat ?? input.deliveryLat
  const lng = input.pickupLng ?? input.deliveryLng
  if (lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)) {
    const nh = await nearestHub({ lat, lng })
    if (!nh.hub) {
      return { hub: hubs[0]!, distanceKm: null, reason: 'nearest_fallback_empty' }
    }
    return { hub: nh.hub, distanceKm: nh.distanceKm, reason: 'nearest_by_coords' }
  }

  for (const c of [input.deliveryCity, input.pickupCity]) {
    if (!c?.trim()) continue
    const hint = c.trim().toLowerCase()
    const cityHub = hubs.find((h) => h.city?.toLowerCase() === hint)
    if (cityHub) {
      return { hub: cityHub, distanceKm: null, reason: 'city_exact' }
    }
  }
  for (const c of [input.deliveryCity, input.pickupCity]) {
    if (!c?.trim()) continue
    const hint = c.trim().toLowerCase()
    const partial = hubs.find(
      (h) =>
        (h.city && h.city.toLowerCase().includes(hint)) ||
        (h.city && hint.includes(h.city.toLowerCase()))
    )
    if (partial) {
      return { hub: partial, distanceKm: null, reason: 'city_partial' }
    }
  }

  console.warn(
    '[booking] Unserviceable pincode or missing coordinates — assigning default hub',
    {
      pickupCity: input.pickupCity,
      deliveryCity: input.deliveryCity,
    }
  )
  return { hub: hubs[0]!, distanceKm: null, reason: 'first_active_hub' }
}

/** Suggest or bind a bus route between two hubs for an order. */
export async function assignRoute(input: z.infer<typeof assignRouteBody>) {
  const order = await prisma.order.findUnique({ where: { id: input.orderId } })
  if (!order) throw new HttpError(404, 'Order not found')

  const route = await prisma.busRoute.findFirst({
    where: {
      originHubId: input.fromHubId,
      destinationHubId: input.toHubId,
      active: true,
    },
  })

  if (!route) {
    return {
      order,
      busRoute: null,
      message: 'No active BusRoute for this hub pair; create one first.',
    }
  }

  const updated = await prisma.order.update({
    where: { id: input.orderId },
    data: {
      orderType: OrderType.BUS_PARCEL,
      sourceHubId: input.fromHubId,
      currentHubId: order.currentHubId ?? input.fromHubId,
    },
    include: { seller: true },
  })

  return { order: updated, busRoute: route }
}
