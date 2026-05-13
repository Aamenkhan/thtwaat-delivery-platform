import {
  OrderStatus,
  OrderType,
  ScanEvent,
  type Hub,
  type Order,
  type OrderItem,
  type OrderPhoto,
  type ScanLog,
  type Shipment,
} from '@prisma/client'
import { prisma } from '../../lib/prisma.js'
import { HttpError } from '../../lib/http-error.js'
import { DELIVERY_BOOKING_OTP_PURPOSE } from '../shipment/booking-otp.service.js'

export type OrderTrackInclude = Order & {
  shipment: Shipment | null
  scanLogs: (ScanLog & {
    worker: { displayName: string | null } | null
    hub: { name: string; city: string | null } | null
  })[]
  photos: OrderPhoto[]
  sourceHub: Hub | null
  destinationHub: Hub | null
  currentHub: Hub | null
  pickupWorker: { displayName: string | null } | null
  assignedWorker: { displayName: string | null } | null
  orderItems: OrderItem[]
  customer: { phone: string; fullName: string } | null
}

const RANK: Partial<Record<OrderStatus, number>> = {
  CREATED: 0,
  PICKUP_ASSIGNED: 1,
  PICKED_UP: 2,
  AT_SOURCE_HUB: 3,
  IN_TRANSIT: 4,
  AT_DESTINATION_HUB: 5,
  OUT_FOR_DELIVERY: 6,
  DELIVERED: 7,
}

function statusRank(status: OrderStatus): number {
  const r = RANK[status]
  if (r != null) return r
  if (status === OrderStatus.CANCELLED) return 0
  return 0
}

export function firstNameOnly(displayName: string | null | undefined): string | null {
  if (!displayName?.trim()) return null
  return displayName.trim().split(/\s+/)[0] ?? null
}

function hubLine(h: { name: string; city: string | null } | null | undefined) {
  if (!h) return null
  return [h.name, h.city].filter(Boolean).join(', ')
}

function inTransitCaption(order: OrderTrackInclude): string {
  if (order.orderType === OrderType.BUS_PARCEL) {
    const meta = order.routingMeta as { primaryMode?: string } | null
    if (meta?.primaryMode && typeof meta.primaryMode === 'string') {
      return `Bus route · ${meta.primaryMode}`
    }
    return 'Bus parcel in network'
  }
  if (order.orderType === OrderType.LOCAL_DELIVERY) {
    return 'Local linehaul'
  }
  return 'In transit'
}

function scanAt(
  logs: OrderTrackInclude['scanLogs'],
  ev: ScanEvent
): string | null {
  const row = logs.find((s) => s.event === ev)
  return row ? new Date(row.scannedAt).toISOString() : null
}

export async function loadOrderWithTrackRelations(
  ref: string
): Promise<OrderTrackInclude> {
  const ship = await prisma.shipment.findFirst({
    where: {
      OR: [{ trackingPublicId: ref }, { trackingNumber: ref }],
    },
    select: { orderId: true },
  })
  let orderId = ship?.orderId
  if (!orderId) {
    const byPub = await prisma.order.findUnique({
      where: { publicId: ref },
      select: { id: true },
    })
    orderId = byPub?.id
  }
  if (!orderId) throw new HttpError(404, 'Order not found')

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      shipment: true,
      scanLogs: {
        orderBy: { scannedAt: 'asc' },
        include: {
          worker: { select: { displayName: true } },
          hub: { select: { name: true, city: true } },
        },
      },
      photos: { orderBy: { createdAt: 'desc' } },
      sourceHub: true,
      destinationHub: true,
      currentHub: true,
      pickupWorker: { select: { displayName: true } },
      assignedWorker: { select: { displayName: true } },
      orderItems: { orderBy: { createdAt: 'asc' }, take: 5 },
      customer: { select: { phone: true, fullName: true } },
    },
  })
  if (!order) throw new HttpError(404, 'Order not found')
  return order as OrderTrackInclude
}

export async function computeOtpVerified(
  orderId: string,
  scanLogs: { event: ScanEvent }[]
): Promise<boolean> {
  if (scanLogs.some((s) => s.event === ScanEvent.OTP_VERIFY)) return true
  const row = await prisma.oTPVerification.findFirst({
    where: {
      orderId,
      purpose: DELIVERY_BOOKING_OTP_PURPOSE,
      consumedAt: { not: null },
    },
  })
  return Boolean(row)
}

export function fallbackEstimatedDelivery(order: Order): Date {
  const hrs = order.orderType === OrderType.BUS_PARCEL ? 48 : 24
  return new Date(order.createdAt.getTime() + hrs * 3600 * 1000)
}

export function canSellerReturn(order: OrderTrackInclude): boolean {
  if (order.status !== OrderStatus.DELIVERED || order.returnInitiated) {
    return false
  }
  const deliveredScan = order.scanLogs.find((s) => s.event === ScanEvent.DELIVERED)
  const t = deliveredScan?.scannedAt ?? order.updatedAt
  return Date.now() - new Date(t).getTime() <= 48 * 3600 * 1000
}

export function productTitle(order: OrderTrackInclude): string {
  const t = order.orderItems[0]?.title
  return t && t.length > 0 ? t : 'Shipment'
}

export function buildUiTimeline(order: OrderTrackInclude) {
  const rank = statusRank(order.status)
  const scans = order.scanLogs
  const pickupScanAt = scanAt(scans, ScanEvent.PICKUP_SCAN)
  const hubDropAt = scanAt(scans, ScanEvent.HUB_DROP_SCAN)
  const hubAcceptAt = scanAt(scans, ScanEvent.HUB_ACCEPT)
  const deliveredAt = scanAt(scans, ScanEvent.DELIVERED)

  const steps: {
    event: string
    label: string
    completedAt: string | null
    detail: string | null
  }[] = [
    {
      event: 'ORDER_PLACED',
      label: 'Order Placed',
      completedAt: new Date(order.createdAt).toISOString(),
      detail: null,
    },
    {
      event: 'PICKUP_ASSIGNED',
      label: 'Pickup Assigned',
      completedAt:
        order.pickupWorkerId || rank >= 1
          ? new Date(order.updatedAt).toISOString()
          : null,
      detail: firstNameOnly(order.pickupWorker?.displayName)
        ? `Agent ${firstNameOnly(order.pickupWorker?.displayName)}`
        : null,
    },
    {
      event: 'PICKED_FROM_SELLER',
      label: 'Picked from Seller',
      completedAt:
        pickupScanAt ?? (rank >= 2 ? new Date(order.updatedAt).toISOString() : null),
      detail: null,
    },
    {
      event: 'AT_SOURCE_HUB',
      label: 'At Source Hub',
      completedAt:
        hubAcceptAt ??
        hubDropAt ??
        (rank >= 3 ? new Date(order.updatedAt).toISOString() : null),
      detail: hubLine(order.sourceHub),
    },
    {
      event: 'IN_TRANSIT',
      label: 'In Transit',
      completedAt: rank >= 4 ? new Date(order.updatedAt).toISOString() : null,
      detail: inTransitCaption(order),
    },
    {
      event: 'AT_DESTINATION_HUB',
      label: 'At Destination Hub',
      completedAt: rank >= 5 ? new Date(order.updatedAt).toISOString() : null,
      detail: hubLine(order.destinationHub),
    },
    {
      event: 'OUT_FOR_DELIVERY',
      label: 'Out for Delivery',
      completedAt: rank >= 6 ? new Date(order.updatedAt).toISOString() : null,
      detail: firstNameOnly(order.assignedWorker?.displayName)
        ? `Rider ${firstNameOnly(order.assignedWorker?.displayName)}`
        : null,
    },
    {
      event: 'DELIVERED',
      label: 'Delivered',
      completedAt:
        deliveredAt ??
        (rank >= 7 ? new Date(order.updatedAt).toISOString() : null),
      detail: null,
    },
  ]

  const firstIncomplete = steps.findIndex((s) => !s.completedAt)
  const timeline = steps.map((s, i) => {
    const completed = Boolean(s.completedAt)
    const isCurrent = firstIncomplete !== -1 && i === firstIncomplete && !completed
    const isPending = !completed && !isCurrent
    return {
      event: s.event,
      label: s.label,
      completedAt: s.completedAt,
      detail: s.detail,
      isCurrent,
      isPending,
    }
  })

  return timeline
}

export async function buildPublicTrackPayload(ref: string) {
  const order = await loadOrderWithTrackRelations(ref)
  const otpVerified = await computeOtpVerified(order.id, order.scanLogs)
  const estimated =
    order.estimatedDeliveryAt ?? fallbackEstimatedDelivery(order)
  const orderNumber =
    order.shipment?.trackingNumber ??
    order.shipment?.trackingPublicId ??
    order.publicId

  const timeline = buildUiTimeline(order)

  return {
    orderNumber,
    status: order.status,
    type: order.orderType,
    productName: productTitle(order),
    createdAt: order.createdAt.toISOString(),
    estimatedDelivery: estimated.toISOString(),
    currentHub: order.currentHub
      ? { name: order.currentHub.name, city: order.currentHub.city }
      : order.sourceHub
        ? { name: order.sourceHub.name, city: order.sourceHub.city }
        : null,
    timeline,
    workerInfo: {
      pickupWorkerName: firstNameOnly(order.pickupWorker?.displayName),
      deliveryWorkerName: firstNameOnly(order.assignedWorker?.displayName),
    },
    otpVerified,
    scanLogs: order.scanLogs.map((s) => ({
      id: s.id,
      event: s.event,
      scannedAt: s.scannedAt.toISOString(),
      hubName: s.hub?.name ?? null,
      hubCity: s.hub?.city ?? null,
      workerFirstName: firstNameOnly(s.worker?.displayName),
      photoUrl: s.photoUrl,
      metadata: s.metadata,
    })),
    photos: order.photos.map((p) => ({
      id: p.id,
      url: p.url,
      kind: p.kind,
      createdAt: p.createdAt.toISOString(),
    })),
    canRequestReturn: canSellerReturn(order),
    publicId: order.publicId,
    qrCode: order.qrCode,
    trackingNumber: order.shipment?.trackingNumber ?? null,
    trackingPublicId: order.shipment?.trackingPublicId ?? null,
  }
}
