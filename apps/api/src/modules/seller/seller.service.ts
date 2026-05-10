import { OrderStatus } from '@prisma/client'
import { prisma } from '../../lib/prisma.js'

export async function getDashboardSummary(sellerId: string) {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const thirtyAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const [openOrders, deliveredThisWeek, returnsPending, byStatus] =
    await Promise.all([
      prisma.order.count({
        where: {
          sellerId,
          status: {
            notIn: [
              OrderStatus.DELIVERED,
              OrderStatus.RETURN_COMPLETED,
              OrderStatus.CANCELLED,
            ],
          },
        },
      }),
      prisma.order.count({
        where: {
          sellerId,
          status: OrderStatus.DELIVERED,
          updatedAt: { gte: weekAgo },
        },
      }),
      prisma.order.count({
        where: {
          sellerId,
          status: {
            in: [
              OrderStatus.RETURN_REQUESTED,
              OrderStatus.RETURN_PICKED,
              OrderStatus.RETURN_IN_TRANSIT,
            ],
          },
        },
      }),
      prisma.order.groupBy({
        by: ['status'],
        where: { sellerId, updatedAt: { gte: thirtyAgo } },
        _count: { _all: true },
      }),
    ])

  return {
    sellerId,
    openOrders,
    deliveredThisWeek,
    returnsPending,
    shipmentsByStatusLast30d: Object.fromEntries(
      byStatus.map((r) => [r.status, r._count._all])
    ) as Record<string, number>,
  }
}

export async function listConnectedStores(sellerId: string) {
  return prisma.connectedStore.findMany({
    where: { sellerId },
    select: {
      id: true,
      provider: true,
      externalId: true,
      displayName: true,
      lastSyncAt: true,
      lastSyncStatus: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { createdAt: 'desc' },
  })
}

export async function listRecentIntegrationJobs(sellerId: string, limit = 30) {
  return prisma.integrationJob.findMany({
    where: { sellerId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      type: true,
      status: true,
      attempts: true,
      lastError: true,
      runAfter: true,
      storeId: true,
      createdAt: true,
      updatedAt: true,
    },
  })
}
