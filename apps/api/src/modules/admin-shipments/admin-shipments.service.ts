import { OrderStatus, type Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma.js'
import { HttpError } from '../../lib/http-error.js'
import { domainEvents } from '../../lib/events.js'
import * as trackingService from '../tracking/tracking.service.js'

export async function adminListShipments(opts: {
  status?: string
  sellerId?: string
  limit: number
  offset: number
}) {
  const where: Prisma.OrderWhereInput = {}
  if (opts.sellerId) where.sellerId = opts.sellerId
  if (opts.status) {
    const m = (Object.values(OrderStatus) as string[]).find(
      (s) => s === opts.status
    )
    if (m) where.status = m as OrderStatus
  }
  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      take: opts.limit,
      skip: opts.offset,
      orderBy: { updatedAt: 'desc' },
      include: {
        shipment: true,
        seller: { select: { id: true, companyName: true } },
        customer: { select: { fullName: true, phone: true } },
        sourceHub: { select: { name: true, code: true } },
        destinationHub: { select: { name: true, code: true } },
      },
    }),
    prisma.order.count({ where }),
  ])
  return { orders, total, limit: opts.limit, offset: opts.offset }
}

export async function adminGetShipment(ref: string) {
  const order = await prisma.order.findFirst({
    where: {
      OR: [{ publicId: ref }, { id: ref }, { qrCode: ref }],
    },
    include: {
      shipment: true,
      seller: { include: { user: { select: { email: true, phone: true } } } },
      customer: true,
      sourceHub: true,
      destinationHub: true,
      currentHub: true,
      pickupLocation: true,
      deliveryLocation: true,
      assignedWorker: true,
      pickupWorker: true,
      scanLogs: {
        orderBy: { scannedAt: 'desc' },
        take: 50,
        include: { worker: true, hub: true },
      },
    },
  })
  if (!order) throw new HttpError(404, 'Shipment not found')
  return order
}

export async function adminAssignShipment(
  publicId: string,
  body: {
    pickupWorkerId?: string | null
    assignedWorkerId?: string | null
  }
) {
  const order = await prisma.order.findUnique({ where: { publicId } })
  if (!order) throw new HttpError(404, 'Shipment not found')

  let nextStatus = order.status
  if (
    body.pickupWorkerId &&
    order.status === OrderStatus.CREATED
  ) {
    nextStatus = OrderStatus.PICKUP_ASSIGNED
  }

  const data: {
    pickupWorkerId?: string | null
    assignedWorkerId?: string | null
    status: OrderStatus
  } = { status: nextStatus }
  if (body.pickupWorkerId !== undefined) {
    data.pickupWorkerId = body.pickupWorkerId
  }
  if (body.assignedWorkerId !== undefined) {
    data.assignedWorkerId = body.assignedWorkerId
  }

  const updated = await prisma.order.update({
    where: { publicId },
    data,
  })

  await prisma.trackingEvent.create({
    data: {
      orderId: updated.id,
      source: 'admin',
      eventKey: 'shipment.workers_assigned',
      payload: {
        pickupWorkerId: updated.pickupWorkerId,
        assignedWorkerId: updated.assignedWorkerId,
        status: updated.status,
      },
    },
  })

  domainEvents.emit('order:tracking:updated', {
    orderId: updated.id,
    publicId: updated.publicId,
    kind: 'assignment',
    eventKey: 'shipment.workers_assigned',
  })

  if (updated.status !== order.status) {
    domainEvents.emit('order:status:changed', {
      orderId: updated.id,
      publicId: updated.publicId,
      from: order.status,
      to: updated.status,
    })
  }

  return updated
}

export async function adminShipmentTimeline(publicId: string) {
  return trackingService.timelineByPublicId(publicId)
}
