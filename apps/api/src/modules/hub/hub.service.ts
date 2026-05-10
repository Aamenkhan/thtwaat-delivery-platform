import { OrderType, type Prisma } from '@prisma/client'
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
  return prisma.hub.findMany({ orderBy: { name: 'asc' } })
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
