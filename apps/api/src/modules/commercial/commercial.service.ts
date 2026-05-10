import {
  IntegrationJobStatus,
  NdrStatus,
  OrderStatus,
  PayoutStatus,
  StoreProvider,
} from '@prisma/client'
import { prisma } from '../../lib/prisma.js'
import { HttpError } from '../../lib/http-error.js'
import { dispatchPlatformWebhook } from '../../lib/webhooks/platform-dispatch.js'
import type { exceptionCreateBody, ndrCreateBody } from './commercial.schema.js'
import type { z } from 'zod'

async function assertOrderForSeller(
  sellerId: string,
  publicId: string
) {
  const order = await prisma.order.findFirst({
    where: { sellerId, publicId },
  })
  if (!order) throw new HttpError(404, 'Order not found')
  return order
}

export async function analyticsSummary(sellerId: string) {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const [byStatus, codOutstanding, openNdr, openExc] = await Promise.all([
    prisma.order.groupBy({
      by: ['status'],
      where: { sellerId, createdAt: { gte: since } },
      _count: { id: true },
    }),
    prisma.order.aggregate({
      where: {
        sellerId,
        codAmountCents: { gt: 0 },
        status: { notIn: [OrderStatus.DELIVERED, OrderStatus.CANCELLED] },
      },
      _sum: { codAmountCents: true },
      _count: { id: true },
    }),
    prisma.ndrAttempt.count({
      where: {
        order: { sellerId },
        status: { in: [NdrStatus.OPEN, NdrStatus.RESCHEDULED] },
      },
    }),
    prisma.deliveryException.count({
      where: { order: { sellerId }, status: 'OPEN' },
    }),
  ])

  return {
    windowDays: 30,
    shipmentsByStatus: Object.fromEntries(
      byStatus.map((r) => [r.status, r._count.id])
    ),
    codInPipelineOrders: codOutstanding._count.id,
    codInPipelinePaise: codOutstanding._sum.codAmountCents ?? 0,
    openNdrCount: openNdr,
    openDeliveryExceptions: openExc,
  }
}

export async function integrationsOverview(sellerId: string) {
  const [shopify, woo, jobs] = await Promise.all([
    prisma.connectedStore.count({
      where: { sellerId, provider: StoreProvider.SHOPIFY, status: 'ACTIVE' },
    }),
    prisma.connectedStore.count({
      where: { sellerId, provider: StoreProvider.WOOCOMMERCE, status: 'ACTIVE' },
    }),
    prisma.integrationJob.count({
      where: {
        sellerId,
        status: {
          in: [
            IntegrationJobStatus.PENDING,
            IntegrationJobStatus.RUNNING,
            IntegrationJobStatus.FAILED,
          ],
        },
      },
    }),
  ])
  return {
    shopifyActiveStores: shopify,
    woocommerceActiveStores: woo,
    integrationJobsActiveOrFailed: jobs,
  }
}

export async function createNdr(
  sellerId: string,
  publicId: string,
  body: z.infer<typeof ndrCreateBody>
) {
  const order = await assertOrderForSeller(sellerId, publicId)
  if (
    order.status !== OrderStatus.OUT_FOR_DELIVERY &&
    order.status !== OrderStatus.AT_DESTINATION_HUB
  ) {
    throw new HttpError(
      400,
      'NDR is only applicable while at destination hub or out for delivery'
    )
  }

  const last = await prisma.ndrAttempt.findFirst({
    where: { orderId: order.id },
    orderBy: { attemptNo: 'desc' },
  })
  const attemptNo = (last?.attemptNo ?? 0) + 1

  const row = await prisma.ndrAttempt.create({
    data: {
      orderId: order.id,
      attemptNo,
      reasonCode: body.reasonCode,
      notes: body.notes,
      status: NdrStatus.OPEN,
      nextAttemptAt: body.nextAttemptAt ? new Date(body.nextAttemptAt) : null,
    },
  })

  await prisma.trackingEvent.create({
    data: {
      orderId: order.id,
      source: 'api',
      eventKey: 'ndr.created',
      payload: { ndrId: row.id, reasonCode: body.reasonCode, attemptNo },
    },
  })

  await dispatchPlatformWebhook({
    event: 'ndr.created',
    orderId: order.id,
    publicId: order.publicId,
    sellerId: order.sellerId,
    status: order.status,
    payload: { ndrId: row.id, reasonCode: body.reasonCode, attemptNo },
  })

  return row
}

export async function listNdr(sellerId: string, publicId: string) {
  const order = await assertOrderForSeller(sellerId, publicId)
  return prisma.ndrAttempt.findMany({
    where: { orderId: order.id },
    orderBy: { createdAt: 'desc' },
  })
}

export async function createException(
  sellerId: string,
  publicId: string,
  body: z.infer<typeof exceptionCreateBody>
) {
  const order = await assertOrderForSeller(sellerId, publicId)

  const row = await prisma.deliveryException.create({
    data: {
      orderId: order.id,
      code: body.code,
      note: body.note,
      status: 'OPEN',
    },
  })

  await prisma.trackingEvent.create({
    data: {
      orderId: order.id,
      source: 'api',
      eventKey: 'exception.reported',
      payload: { exceptionId: row.id, code: body.code },
    },
  })

  await dispatchPlatformWebhook({
    event: 'exception.reported',
    orderId: order.id,
    publicId: order.publicId,
    sellerId: order.sellerId,
    status: order.status,
    payload: { exceptionId: row.id, code: body.code },
  })

  return row
}

export async function listExceptions(sellerId: string, publicId: string) {
  const order = await assertOrderForSeller(sellerId, publicId)
  return prisma.deliveryException.findMany({
    where: { orderId: order.id },
    orderBy: { reportedAt: 'desc' },
  })
}

export async function resolveException(
  sellerId: string,
  publicId: string,
  exceptionId: string
) {
  const order = await assertOrderForSeller(sellerId, publicId)
  const ex = await prisma.deliveryException.findFirst({
    where: { id: exceptionId, orderId: order.id },
  })
  if (!ex) throw new HttpError(404, 'Exception not found')
  return prisma.deliveryException.update({
    where: { id: exceptionId },
    data: { status: 'RESOLVED', resolvedAt: new Date() },
  })
}

export async function adminOpsSummary() {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const [
    activeShipments,
    openNdr,
    openExc,
    pendingPayouts,
    unsettledEarnings,
  ] = await Promise.all([
    prisma.order.count({
      where: {
        status: {
          notIn: [
            OrderStatus.DELIVERED,
            OrderStatus.CANCELLED,
            OrderStatus.RETURN_COMPLETED,
          ],
        },
      },
    }),
    prisma.ndrAttempt.count({
      where: { status: { in: [NdrStatus.OPEN, NdrStatus.RESCHEDULED] } },
    }),
    prisma.deliveryException.count({ where: { status: 'OPEN' } }),
    prisma.payout.count({ where: { status: PayoutStatus.PENDING } }),
    prisma.workerEarning.count({ where: { settledAt: null } }),
  ])

  const failedJobs = await prisma.integrationJob.count({
    where: { status: 'FAILED', updatedAt: { gte: since } },
  })

  return {
    activeShipmentsNetworkWide: activeShipments,
    openNdrCases: openNdr,
    openDeliveryExceptions: openExc,
    pendingSellerPayouts: pendingPayouts,
    unsettledWorkerEarnings: unsettledEarnings,
    integrationJobsFailedLast24h: failedJobs,
  }
}

export async function runWorkerSettlement() {
  return prisma.$transaction(async (tx) => {
    const pending = await tx.workerEarning.findMany({
      where: { settledAt: null },
      take: 2000,
    })
    if (pending.length === 0) {
      return { batch: null, settledCount: 0 }
    }
    const total = pending.reduce((s, e) => s + e.amountCents, 0)
    const batch = await tx.settlementBatch.create({
      data: {
        kind: 'WORKER_EARNINGS',
        status: 'COMPLETED',
        totalCents: total,
        completedAt: new Date(),
        metadata: { earningIds: pending.map((p) => p.id) },
      },
    })
    await tx.workerEarning.updateMany({
      where: { id: { in: pending.map((p) => p.id) } },
      data: {
        settledAt: new Date(),
        settlementBatchId: batch.id,
      },
    })
    return { batch, settledCount: pending.length, totalCents: total }
  })
}
