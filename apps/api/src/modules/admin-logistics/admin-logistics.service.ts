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

export async function listSellersForAdmin(opts: { limit: number; offset: number }) {
  const [sellers, total] = await Promise.all([
    prisma.seller.findMany({
      take: opts.limit,
      skip: opts.offset,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { email: true, phone: true } },
        organization: { select: { id: true, name: true, slug: true } },
        _count: { select: { orders: true } },
      },
    }),
    prisma.seller.count(),
  ])
  return {
    sellers: sellers.map((s) => ({
      id: s.id,
      companyName: s.companyName,
      createdAt: s.createdAt,
      user: s.user,
      organization: s.organization,
      orderCount: s._count.orders,
    })),
    total,
    limit: opts.limit,
    offset: opts.offset,
  }
}

export async function listIndiaPricingSlabs() {
  return prisma.indiaPricingSlab.findMany({
    orderBy: { minDeadWeightGrams: 'asc' },
  })
}

export async function listHubZonesForAdmin() {
  return prisma.hubZone.findMany({
    orderBy: [{ hubId: 'asc' }, { code: 'asc' }],
    include: {
      hub: { select: { id: true, name: true, code: true, city: true } },
    },
  })
}

export async function listCodOrdersForAdmin(opts: { limit: number; offset: number }) {
  const where = {
    codAmountCents: { gt: 0 } as const,
  }
  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      take: opts.limit,
      skip: opts.offset,
      orderBy: { updatedAt: 'desc' },
      select: {
        publicId: true,
        status: true,
        codAmountCents: true,
        updatedAt: true,
        seller: { select: { id: true, companyName: true } },
        shipment: { select: { trackingNumber: true, trackingPublicId: true } },
      },
    }),
    prisma.order.count({ where }),
  ])
  return { orders, total, limit: opts.limit, offset: opts.offset }
}

export async function getAdminNetworkAnalytics() {
  const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const byStatus = await prisma.order.groupBy({
    by: ['status'],
    where: { createdAt: { gte: since30 } },
    _count: { id: true },
  })

  const ordersCreatedByDay: { date: string; count: number }[] = []
  for (let i = 6; i >= 0; i--) {
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    start.setDate(start.getDate() - i)
    const end = new Date(start)
    end.setDate(end.getDate() + 1)
    const count = await prisma.order.count({
      where: { createdAt: { gte: start, lt: end } },
    })
    ordersCreatedByDay.push({
      date: start.toISOString().slice(0, 10),
      count,
    })
  }

  return {
    windowDays: 30,
    ordersByStatus: Object.fromEntries(byStatus.map((r) => [r.status, r._count.id])),
    ordersCreatedByDay,
  }
}
