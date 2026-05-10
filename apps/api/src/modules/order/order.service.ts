import { randomUUID } from 'node:crypto'
import { OrderStatus, Role } from '@prisma/client'
import { prisma } from '../../lib/prisma.js'
import { HttpError } from '../../lib/http-error.js'
import { domainEvents } from '../../lib/events.js'
import { allocTrackingNumber } from '../../lib/tracking-number.js'
import { dispatchPlatformWebhook } from '../../lib/webhooks/platform-dispatch.js'
import type { createOrderBody, assignSourceHubBody, returnOrderBody } from './order.schema.js'
import type { z } from 'zod'

function newQrCode() {
  return `ord_${randomUUID().replace(/-/g, '')}`
}

export async function createOrderAsSeller(
  sellerId: string,
  input: z.infer<typeof createOrderBody>
) {
  const order = await prisma.$transaction(async (tx) => {
    const o = await tx.order.create({
      data: {
        qrCode: newQrCode(),
        sellerId,
        customerId: input.customerId,
        orderType: input.orderType,
        destinationAddress: input.destination.address,
        destinationLat: input.destination.lat,
        destinationLng: input.destination.lng,
        status: OrderStatus.CREATED,
      },
    })
    await tx.shipment.create({
      data: {
        orderId: o.id,
        trackingNumber: await allocTrackingNumber(tx),
      },
    })
    await tx.trackingEvent.create({
      data: {
        orderId: o.id,
        source: 'order',
        eventKey: 'order.created',
        payload: { publicId: o.publicId, status: o.status },
      },
    })
    return o
  })

  void dispatchPlatformWebhook({
    event: 'order.created',
    orderId: order.id,
    publicId: order.publicId,
    sellerId: order.sellerId,
    status: order.status,
  }).catch(console.error)

  return order
}

export async function createOrder(
  input: z.infer<typeof createOrderBody>,
  auth: { userId: string; role: Role; orgId?: string }
) {
  let sellerId = input.sellerId

  if (auth.role === Role.SELLER) {
    const seller = auth.orgId
      ? await prisma.seller.findFirst({
          where: { userId: auth.userId, organizationId: auth.orgId },
        })
      : await prisma.seller.findUnique({ where: { userId: auth.userId } })
    if (!seller) throw new HttpError(403, 'Seller profile not found')
    sellerId = seller.id
  } else if (auth.role === Role.HUB_MANAGER) {
    if (!auth.orgId) {
      throw new HttpError(400, 'Active organization required')
    }
    const seller = await prisma.seller.findFirst({
      where: { organizationId: auth.orgId },
      orderBy: { createdAt: 'asc' },
    })
    if (!seller) throw new HttpError(403, 'No seller for workspace')
    sellerId = seller.id
  } else if (
    (auth.role === Role.ADMIN || auth.role === Role.SUPER_ADMIN) &&
    !sellerId
  ) {
    throw new HttpError(400, 'sellerId is required when acting as admin')
  }

  if (!sellerId) {
    throw new HttpError(400, 'sellerId is required')
  }

  return createOrderAsSeller(sellerId, input)
}

export async function assignSourceHub(
  publicId: string,
  input: z.infer<typeof assignSourceHubBody>
) {
  const order = await prisma.order.findUnique({ where: { publicId } })
  if (!order) throw new HttpError(404, 'Order not found')

  const hub = await prisma.hub.findUnique({ where: { id: input.hubId } })
  if (!hub) throw new HttpError(404, 'Hub not found')

  return prisma.order.update({
    where: { publicId },
    data: {
      sourceHubId: input.hubId,
      currentHubId: order.currentHubId ?? input.hubId,
    },
  })
}

export async function requestReturn(
  publicId: string,
  input: z.infer<typeof returnOrderBody>
) {
  const order = await prisma.order.findUnique({ where: { publicId } })
  if (!order) throw new HttpError(404, 'Order not found')
  if (order.status !== OrderStatus.DELIVERED) {
    throw new HttpError(400, 'Returns only after DELIVERED')
  }

  const updated = await prisma.$transaction(async (tx) => {
    const o = await tx.order.update({
      where: { publicId },
      data: {
        returnInitiated: true,
        status: OrderStatus.RETURN_REQUESTED,
      },
    })
    await tx.returnOrder.upsert({
      where: { originalOrderId: o.id },
      create: {
        originalOrderId: o.id,
        reason: input.reason,
        status: 'REQUESTED',
      },
      update: {
        reason: input.reason,
        status: 'REQUESTED',
      },
    })
    return o
  })

  domainEvents.emit('order:status:changed', {
    orderId: updated.id,
    publicId: updated.publicId,
    from: OrderStatus.DELIVERED,
    to: OrderStatus.RETURN_REQUESTED,
  })

  return updated
}

export async function getByPublicId(publicId: string) {
  const order = await prisma.order.findUnique({
    where: { publicId },
    include: {
      seller: true,
      customer: true,
      sourceHub: true,
      currentHub: true,
      assignedWorker: true,
      shipment: true,
      pickupLocation: true,
      deliveryLocation: true,
    },
  })
  if (!order) throw new HttpError(404, 'Order not found')
  return order
}

export type OrderAccessView = NonNullable<Awaited<ReturnType<typeof getByPublicId>>>

export async function assertOrderAccess(
  order: OrderAccessView,
  auth: { userId: string; role: Role; orgId?: string }
) {
  switch (auth.role) {
    case Role.ADMIN:
    case Role.SUPER_ADMIN:
      return
    case Role.SELLER: {
      if (order.seller.userId !== auth.userId) {
        throw new HttpError(403, 'Order is not in your account')
      }
      if (auth.orgId && order.seller.organizationId !== auth.orgId) {
        throw new HttpError(403, 'Order belongs to a different workspace')
      }
      return
    }
    case Role.HUB_MANAGER: {
      if (!auth.orgId || order.seller.organizationId !== auth.orgId) {
        throw new HttpError(403, 'Order is outside your workspace')
      }
      return
    }
    case Role.HUB:
      return
    case Role.WORKER:
    case Role.DELIVERY_WORKER: {
      const w = await prisma.worker.findUnique({
        where: { userId: auth.userId },
        select: { id: true },
      })
      if (!w) throw new HttpError(403, 'Worker profile required')
      if (order.assignedWorkerId !== w.id) {
        throw new HttpError(403, 'Order not assigned to you')
      }
      return
    }
    case Role.CUSTOMER: {
      const customer = await prisma.customer.findUnique({
        where: { userId: auth.userId },
      })
      if (!customer || order.customerId !== customer.id) {
        throw new HttpError(403, 'Order not found')
      }
      return
    }
    default:
      throw new HttpError(403, 'Cannot view this order')
  }
}

export async function assertOrderReturnEligible(
  order: OrderAccessView,
  auth: { userId: string; role: Role; orgId?: string }
) {
  if (auth.role === Role.ADMIN || auth.role === Role.SUPER_ADMIN) return
  if (auth.role === Role.SELLER) {
    if (order.seller.userId !== auth.userId) {
      throw new HttpError(403, 'Cannot return orders for another seller')
    }
    if (auth.orgId && order.seller.organizationId !== auth.orgId) {
      throw new HttpError(403, 'Order is in a different workspace')
    }
    return
  }
  if (auth.role === Role.HUB_MANAGER) {
    if (!auth.orgId || order.seller.organizationId !== auth.orgId) {
      throw new HttpError(403, 'Cannot return orders outside your workspace')
    }
    return
  }
  throw new HttpError(403, 'Cannot initiate return for this order')
}

export async function assertAssignSourceHubAllowed(
  order: OrderAccessView,
  auth: { userId: string; role: Role; orgId?: string }
) {
  if (auth.role === Role.ADMIN || auth.role === Role.SUPER_ADMIN) return
  if (auth.role === Role.HUB || auth.role === Role.HUB_MANAGER) return
  if (auth.role === Role.SELLER) {
    if (order.seller.userId !== auth.userId) {
      throw new HttpError(403, 'Forbidden')
    }
    if (auth.orgId && order.seller.organizationId !== auth.orgId) {
      throw new HttpError(403, 'Wrong workspace')
    }
    return
  }
  throw new HttpError(403, 'Cannot assign hub for this order')
}

export async function adminSetStatus(publicId: string, status: OrderStatus) {
  const existing = await prisma.order.findUnique({ where: { publicId } })
  if (!existing) throw new HttpError(404, 'Order not found')
  const order = await prisma.order.update({
    where: { publicId },
    data: { status },
  })
  domainEvents.emit('order:status:changed', {
    orderId: order.id,
    publicId: order.publicId,
    from: existing.status,
    to: order.status,
  })
  return order
}

/** Event-driven status transition used by scan + OTP flows. */
export async function transitionStatus(
  orderId: string,
  to: OrderStatus,
  extra?: { returnInitiated?: boolean; currentHubId?: string | null }
) {
  const existing = await prisma.order.findUnique({ where: { id: orderId } })
  if (!existing) throw new HttpError(404, 'Order not found')

  const order = await prisma.order.update({
    where: { id: orderId },
    data: {
      status: to,
      returnInitiated: extra?.returnInitiated ?? undefined,
      currentHubId:
        extra?.currentHubId === undefined ? undefined : extra.currentHubId,
    },
  })

  domainEvents.emit('order:status:changed', {
    orderId: order.id,
    publicId: order.publicId,
    from: existing.status,
    to: order.status,
  })

  return order
}
