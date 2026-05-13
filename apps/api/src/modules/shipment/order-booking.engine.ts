import { randomUUID } from 'node:crypto'
import {
  OrderStatus,
  OrderType,
  ScanEvent,
  type Hub,
  type Order,
  type Prisma,
  type Shipment,
} from '@prisma/client'
import { prisma } from '../../lib/prisma.js'
import { domainEvents } from '../../lib/events.js'
import { HttpError } from '../../lib/http-error.js'
import { allocTrackingNumber } from '../../lib/tracking-number.js'
import { nearestHub, resolveHubWithPincodeFallback } from '../hub/hub.service.js'
import { quote } from '../pricing/pricing.service.js'
import { planRouteByPincode } from '../logistics/india-routing.service.js'
import { quoteIndia } from '../logistics/india-pricing.service.js'
import * as pincodeSvc from '../logistics/pincode.service.js'
import type { createPartnerOrderBody } from '../api-orders/api-orders.schema.js'
import type { z } from 'zod'

export const BOOKING_SCAN_PHOTO =
  'https://static.thtwaat.com/scans/booking-received-placeholder.png'

export function newQrCode() {
  return `ord_${randomUUID().replace(/-/g, '')}`
}

function addBusinessDays(from: Date, businessDays: number): Date {
  const d = new Date(from)
  let added = 0
  while (added < businessDays) {
    d.setUTCDate(d.getUTCDate() + 1)
    const wd = d.getUTCDay()
    if (wd !== 0 && wd !== 6) added += 1
  }
  return d
}

export function weightGramsFromInput(
  weight: z.infer<typeof createPartnerOrderBody>['weight']
) {
  if (weight.grams != null) return Math.round(weight.grams)
  return Math.round((weight.kg ?? 0) * 1000)
}

export function mapParcelToOrderType(
  _parcel: z.infer<typeof createPartnerOrderBody>['parcelType']
): OrderType {
  return OrderType.LOCAL_DELIVERY
}

export type StructuredAddressInput = {
  label?: string | null
  line1: string
  line2?: string | null
  city?: string | null
  state?: string | null
  postalCode?: string | null
  country?: string | null
  latitude?: number | null
  longitude?: number | null
  contactName?: string | null
  contactPhone?: string | null
}

export type BookShipmentOptions = {
  channel: string
  structuredPickup?: StructuredAddressInput
  structuredDelivery?: StructuredAddressInput
}

export type BookShipmentInput = z.infer<typeof createPartnerOrderBody>

function toAddressCreate(a: StructuredAddressInput): Prisma.AddressCreateInput {
  return {
    label: a.label ?? undefined,
    line1: a.line1,
    line2: a.line2 ?? undefined,
    city: a.city ?? undefined,
    state: a.state ?? undefined,
    postalCode: a.postalCode ?? undefined,
    country: a.country ?? 'IN',
    latitude: a.latitude ?? undefined,
    longitude: a.longitude ?? undefined,
    contactName: a.contactName ?? undefined,
    contactPhone: a.contactPhone ?? undefined,
  }
}

export type BookShipmentEngineResult = {
  order: Order
  shipment: Shipment
  hub: Hub
  routePlan: Awaited<ReturnType<typeof planRouteByPincode>> | null
  pricingBreakdown: Prisma.JsonObject & {
    currency: string
    amountCents: number
    hubId?: string | null
    zoneCode?: string | null
  }
  weightGrams: number
  codAmountCents: number
  hubDistanceKm: number | null
  hubLat: number
  hubLng: number
}

/**
 * Core booking: hub + routing + pricing, customer upsert, order + shipment + timeline + booking scan.
 */
export async function runBookShipment(
  input: BookShipmentInput,
  opts: BookShipmentOptions
): Promise<BookShipmentEngineResult> {
  const weightGrams = weightGramsFromInput(input.weight)
  const codAmountCents = Math.round(input.codAmount * 100)
  const orderType = input.orderType ?? mapParcelToOrderType(input.parcelType)

  const usePincode =
    input.pickupPincode &&
    input.deliveryPincode &&
    input.pickupPincode.length === 6 &&
    input.deliveryPincode.length === 6

  let hub: Hub
  let hubDistanceKm: number | null = null
  let routePlan: Awaited<ReturnType<typeof planRouteByPincode>> | null = null
  let originPinRow: Awaited<ReturnType<typeof pincodeSvc.findPincodeDirectory>> | null =
    null
  let destPinRow: Awaited<ReturnType<typeof pincodeSvc.findPincodeDirectory>> | null =
    null

  if (usePincode) {
    originPinRow = await pincodeSvc.findPincodeDirectory(input.pickupPincode!)
    destPinRow = await pincodeSvc.findPincodeDirectory(input.deliveryPincode!)

    if (originPinRow && destPinRow) {
      routePlan = await planRouteByPincode(
        input.pickupPincode!,
        input.deliveryPincode!
      )
      hub = await prisma.hub.findUniqueOrThrow({
        where: { id: routePlan.sourceHubId },
      })
      hubDistanceKm = null
    } else {
      console.warn('[booking] pincode not in directory — using fallback hub assignment', {
        pickupPincode: input.pickupPincode,
        deliveryPincode: input.deliveryPincode,
        hadOriginRow: Boolean(originPinRow),
        hadDestRow: Boolean(destPinRow),
      })
      const resolved = await resolveHubWithPincodeFallback({
        deliveryLat: input.deliveryLat,
        deliveryLng: input.deliveryLng,
        pickupLat: input.pickupLat,
        pickupLng: input.pickupLng,
        deliveryCity: input.deliveryCity ?? null,
        pickupCity: input.pickupCity ?? null,
      })
      hub = resolved.hub
      hubDistanceKm = resolved.distanceKm
      routePlan = null
    }
  } else {
    const hubLat = input.pickupLat ?? input.deliveryLat
    const hubLng = input.pickupLng ?? input.deliveryLng
    if (hubLat == null || hubLng == null || !Number.isFinite(hubLat) || !Number.isFinite(hubLng)) {
      throw new HttpError(
        400,
        'Provide pickup/delivery coordinates, or both 6-digit pincodes'
      )
    }
    const nh = await nearestHub({
      lat: hubLat,
      lng: hubLng,
    })
    if (!nh.hub) {
      throw new HttpError(
        400,
        'No hub configured; seed a hub before creating orders'
      )
    }
    hub = nh.hub
    hubDistanceKm = nh.distanceKm
  }

  const hubLat = input.pickupLat ?? input.deliveryLat ?? hub.latitude
  const hubLng = input.pickupLng ?? input.deliveryLng ?? hub.longitude

  let pricingBreakdown: BookShipmentEngineResult['pricingBreakdown']
  if (usePincode && originPinRow && destPinRow) {
    const india = await quoteIndia({
      deadWeightGrams: weightGrams,
      lengthCm: input.dimensions?.lengthCm,
      widthCm: input.dimensions?.widthCm,
      heightCm: input.dimensions?.heightCm,
      codAmountPaise: codAmountCents,
      originLat: originPinRow.latitude ?? originPinRow.serviceHub.latitude,
      originLng: originPinRow.longitude ?? originPinRow.serviceHub.longitude,
      destLat:
        destPinRow.latitude ??
        input.deliveryLat ??
        destPinRow.serviceHub.latitude,
      destLng:
        destPinRow.longitude ??
        input.deliveryLng ??
        destPinRow.serviceHub.longitude,
      originState: originPinRow.state,
      destState: destPinRow.state,
      destZoneClass: destPinRow.zoneClass,
      express: input.express ?? false,
    })
    pricingBreakdown = {
      engine: 'india_dynamic',
      ...india,
    } as BookShipmentEngineResult['pricingBreakdown']
  } else {
    pricingBreakdown = await quote({
      orderType,
      origin: { lat: hubLat, lng: hubLng },
      destination: {
        lat: input.deliveryLat ?? hub.latitude,
        lng: input.deliveryLng ?? hub.longitude,
      },
      hubId: hub.id,
      weightKg: weightGrams / 1000,
    })
  }

  const transitDays = routePlan?.totalTransitDays ?? 2
  const estimatedDeliveryAt = addBusinessDays(
    new Date(),
    Math.max(2, transitDays)
  )
  const qrCode = newQrCode()

  const { order, shipment } = await prisma.$transaction(async (tx) => {
    let pickupLocationId: string | undefined
    let deliveryLocationId: string | undefined
    if (opts.structuredPickup) {
      const row = await tx.address.create({
        data: toAddressCreate(opts.structuredPickup),
      })
      pickupLocationId = row.id
    }
    if (opts.structuredDelivery) {
      const row = await tx.address.create({
        data: toAddressCreate(opts.structuredDelivery),
      })
      deliveryLocationId = row.id
    }

    let customer = await tx.customer.findFirst({
      where: { phone: input.customerPhone },
    })
    if (!customer) {
      customer = await tx.customer.create({
        data: {
          fullName: input.customerName,
          phone: input.customerPhone,
          addressLine1: input.deliveryAddress,
        },
      })
    } else {
      customer = await tx.customer.update({
        where: { id: customer.id },
        data: {
          fullName: input.customerName,
          addressLine1: input.deliveryAddress,
        },
      })
    }

    const order = await tx.order.create({
      data: {
        qrCode,
        sellerId: input.sellerId,
        customerId: customer.id,
        orderType,
        status: OrderStatus.CREATED,
        sourceHubId: hub.id,
        currentHubId: hub.id,
        destinationHubId: routePlan?.destinationHubId ?? hub.id,
        destinationAddress: input.deliveryAddress,
        destinationLat: input.deliveryLat,
        destinationLng: input.deliveryLng,
        pickupAddress: input.pickupAddress,
        pickupLat: input.pickupLat ?? null,
        pickupLng: input.pickupLng ?? null,
        pickupPincode: input.pickupPincode ?? null,
        deliveryPincode: input.deliveryPincode ?? null,
        pickupLocationId,
        deliveryLocationId,
        routingMeta: routePlan
          ? {
              legs: routePlan.legs,
              totalTransitDays: routePlan.totalTransitDays,
              primaryMode: routePlan.primaryMode,
            }
          : undefined,
        parcelType: input.parcelType,
        weightGrams,
        dimensionsJson: input.dimensions
          ? {
              lengthCm: input.dimensions.lengthCm,
              widthCm: input.dimensions.widthCm,
              heightCm: input.dimensions.heightCm,
            }
          : undefined,
        codAmountCents,
        estimatedDeliveryAt,
      },
    })

    const trackingNumber = await allocTrackingNumber(tx)
    const shipment = await tx.shipment.create({
      data: {
        orderId: order.id,
        trackingNumber,
        metadata: {
          hubDistanceKm,
          parcelType: input.parcelType,
          panIndia: Boolean(routePlan),
        },
      },
    })

    await tx.trackingEvent.create({
      data: {
        orderId: order.id,
        source: 'booking',
        eventKey: 'order.created',
        payload: {
          publicId: order.publicId,
          trackingId: shipment.trackingPublicId,
          trackingNumber: shipment.trackingNumber,
          hubId: hub.id,
          channel: opts.channel,
        },
      },
    })

    await tx.trackingEvent.create({
      data: {
        orderId: order.id,
        source: 'pricing',
        eventKey: 'pricing.quoted',
        payload: {
          currency: pricingBreakdown.currency,
          amountCents: pricingBreakdown.amountCents,
          hubId: pricingBreakdown.hubId,
          zoneCode: pricingBreakdown.zoneCode ?? null,
        },
      },
    })

    await tx.scanLog.create({
      data: {
        orderId: order.id,
        event: ScanEvent.BOOKING_RECEIVED,
        qrCode: order.qrCode,
        workerId: null,
        photoUrl: BOOKING_SCAN_PHOTO,
        latitude: hubLat,
        longitude: hubLng,
        scannedAt: new Date(),
        hubId: hub.id,
        metadata: {
          channel: opts.channel,
          parcelType: input.parcelType,
          codAmountCents,
        },
      },
    })

    return { order, shipment }
  })

  domainEvents.emit('order:booked', {
    orderId: order.id,
    publicId: order.publicId,
  })

  return {
    order,
    shipment,
    hub,
    routePlan,
    pricingBreakdown,
    weightGrams,
    codAmountCents,
    hubDistanceKm,
    hubLat,
    hubLng,
  }
}
