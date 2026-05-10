import { HubType, TransportMode } from '@prisma/client'
import { prisma } from '../../lib/prisma.js'
import { HttpError } from '../../lib/http-error.js'
import { distanceKm } from '../../lib/geo.js'
import * as pincodeSvc from './pincode.service.js'

export type RouteLeg = {
  fromHubId: string
  toHubId: string
  fromHubCode: string | null
  toHubCode: string | null
  mode: TransportMode
  transitDays: number
  distanceKm: number | null
}

export type IndiaRoutePlan = {
  sourceHubId: string
  destinationHubId: string
  legs: RouteLeg[]
  totalTransitDays: number
  primaryMode: TransportMode
  originPin: string
  destPin: string
  originZoneClass: string
  destZoneClass: string
}

async function findDirectRoute(originHubId: string, destHubId: string) {
  return prisma.interHubRoute.findFirst({
    where: {
      originHubId,
      destHubId,
      active: true,
    },
    orderBy: { priority: 'desc' },
  })
}

export async function getNationalSortHub() {
  const h = await prisma.hub.findFirst({
    where: { hubType: HubType.NATIONAL, code: 'DEL_NHD' },
  })
  if (!h) {
    throw new HttpError(500, 'National hub DEL_NHD not configured')
  }
  return h
}

/**
 * Plans trunk + last-mile using pincode directory rows and `InterHubRoute` lanes.
 * Fallback path: origin city hub → national sort (Delhi) → destination city hub.
 */
export async function planRouteByPincode(
  originPin: string,
  destPin: string
): Promise<IndiaRoutePlan> {
  const o = await pincodeSvc.lookupPincode(originPin)
  const d = await pincodeSvc.lookupPincode(destPin)

  const originHub = o.serviceHub
  const destHub = d.serviceHub

  const direct = await findDirectRoute(originHub.id, destHub.id)
  if (direct) {
    return {
      sourceHubId: originHub.id,
      destinationHubId: destHub.id,
      legs: [
        {
          fromHubId: originHub.id,
          toHubId: destHub.id,
          fromHubCode: originHub.code,
          toHubCode: destHub.code,
          mode: direct.mode,
          transitDays: direct.transitDays,
          distanceKm: direct.distanceKm,
        },
      ],
      totalTransitDays: direct.transitDays,
      primaryMode: direct.mode,
      originPin: o.pincode,
      destPin: d.pincode,
      originZoneClass: o.zoneClass,
      destZoneClass: d.zoneClass,
    }
  }

  const national = await getNationalSortHub()
  const legs: RouteLeg[] = []

  const leg1 = await findDirectRoute(originHub.id, national.id)
  if (leg1) {
    legs.push({
      fromHubId: originHub.id,
      toHubId: national.id,
      fromHubCode: originHub.code,
      toHubCode: national.code,
      mode: leg1.mode,
      transitDays: leg1.transitDays,
      distanceKm: leg1.distanceKm,
    })
  } else {
    const dkm =
      originHub.latitude != null && originHub.longitude != null
        ? distanceKm(
            { lat: originHub.latitude, lng: originHub.longitude },
            { lat: national.latitude, lng: national.longitude }
          )
        : null
    const mode =
      dkm != null && dkm > 1200 ? TransportMode.AIR : TransportMode.SURFACE
    legs.push({
      fromHubId: originHub.id,
      toHubId: national.id,
      fromHubCode: originHub.code,
      toHubCode: national.code,
      mode,
      transitDays: mode === TransportMode.AIR ? 2 : 3,
      distanceKm: dkm,
    })
  }

  const leg2 = await findDirectRoute(national.id, destHub.id)
  if (leg2) {
    legs.push({
      fromHubId: national.id,
      toHubId: destHub.id,
      fromHubCode: national.code,
      toHubCode: destHub.code,
      mode: leg2.mode,
      transitDays: leg2.transitDays,
      distanceKm: leg2.distanceKm,
    })
  } else {
    const dkm =
      national.latitude != null &&
      destHub.latitude != null &&
      national.longitude != null &&
      destHub.longitude != null
        ? distanceKm(
            { lat: national.latitude, lng: national.longitude },
            { lat: destHub.latitude, lng: destHub.longitude }
          )
        : null
    const mode =
      dkm != null && dkm > 1200 ? TransportMode.AIR : TransportMode.SURFACE
    legs.push({
      fromHubId: national.id,
      toHubId: destHub.id,
      fromHubCode: national.code,
      toHubCode: destHub.code,
      mode,
      transitDays: mode === TransportMode.AIR ? 2 : 3,
      distanceKm: dkm,
    })
  }

  const totalTransitDays = legs.reduce((s, l) => s + l.transitDays, 0)
  const primaryMode =
    legs.some((l) => l.mode === TransportMode.AIR) ?
      TransportMode.AIR
    : TransportMode.SURFACE

  return {
    sourceHubId: originHub.id,
    destinationHubId: destHub.id,
    legs,
    totalTransitDays,
    primaryMode,
    originPin: o.pincode,
    destPin: d.pincode,
    originZoneClass: o.zoneClass,
    destZoneClass: d.zoneClass,
  }
}
