import { OrderStatus } from '@prisma/client'
import { prisma } from '../../lib/prisma.js'

export async function getLogisticsSummary() {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000)

  const [
    liveShipments,
    failedLast24h,
    codPendingCents,
    byCity,
    hubPerf,
  ] = await Promise.all([
    prisma.order.count({
      where: {
        status: {
          notIn: [OrderStatus.DELIVERED, OrderStatus.CANCELLED, OrderStatus.RETURN_COMPLETED],
        },
      },
    }),
    prisma.order.count({
      where: {
        status: OrderStatus.CANCELLED,
        updatedAt: { gte: since },
      },
    }),
    prisma.order.aggregate({
      where: {
        codAmountCents: { gt: 0 },
        status: { notIn: [OrderStatus.DELIVERED, OrderStatus.CANCELLED] },
      },
      _sum: { codAmountCents: true },
    }),
    prisma.order.groupBy({
      by: ['destinationHubId'],
      where: { destinationHubId: { not: null } },
      _count: { id: true },
    }),
    prisma.order.groupBy({
      by: ['sourceHubId'],
      where: { sourceHubId: { not: null } },
      _count: { id: true },
    }),
  ])

  const hubIds = [
    ...new Set([
      ...byCity.map((r) => r.destinationHubId).filter(Boolean),
      ...hubPerf.map((r) => r.sourceHubId).filter(Boolean),
    ] as string[]),
  ]

  const hubs = await prisma.hub.findMany({
    where: { id: { in: hubIds } },
    select: { id: true, code: true, city: true, state: true },
  })
  const hubMap = new Map(hubs.map((h) => [h.id, h]))

  return {
    liveShipmentCount: liveShipments,
    failedDeliveriesLast24h: failedLast24h,
    codPendingPaise: codPendingCents._sum.codAmountCents ?? 0,
    cityWise: byCity.map((row) => ({
      hubId: row.destinationHubId,
      hub: hubMap.get(row.destinationHubId!) ?? null,
      orders: row._count.id,
    })),
    hubPerformance: hubPerf.map((row) => ({
      hubId: row.sourceHubId,
      hub: hubMap.get(row.sourceHubId!) ?? null,
      outboundOrders: row._count.id,
    })),
  }
}
