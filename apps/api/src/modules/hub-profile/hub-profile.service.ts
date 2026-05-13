import {
  HubGigRole,
  OrderStatus,
  PartnerTruckBookingStatus,
  Prisma,
  TruckOwnership,
  WorkerRole,
} from '@prisma/client'
import { prisma } from '../../lib/prisma.js'
import { HttpError } from '../../lib/http-error.js'

const PENDING_AT_HUB: OrderStatus[] = [
  OrderStatus.AT_SOURCE_HUB,
  OrderStatus.AT_DESTINATION_HUB,
]

function startOfDay(d: Date) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function subDays(d: Date, n: number) {
  const x = new Date(d)
  x.setDate(x.getDate() - n)
  return x
}

export async function assertHub(hubId: string) {
  const hub = await prisma.hub.findUnique({ where: { id: hubId } })
  if (!hub) throw new HttpError(404, 'Hub not found')
  return hub
}

export async function getProfile(hubId: string) {
  const hub = await assertHub(hubId)
  const profile = await prisma.hubProfile.findUnique({ where: { hubId } })
  const [workers, busCount, transportCount, openBookings] = await Promise.all([
    prisma.hubWorkerAssignment.count({ where: { hubId } }),
    prisma.busServicePartner.count({ where: { hubId } }),
    prisma.transportPartner.count({ where: { hubId } }),
    prisma.partnerTruckBooking.count({
      where: {
        bookedByHubId: hubId,
        status: { notIn: [PartnerTruckBookingStatus.DELIVERED, PartnerTruckBookingStatus.CANCELLED] },
      },
    }),
  ])
  return {
    hub,
    profile,
    stats: {
      gigWorkers: workers,
      busPartners: busCount,
      transportPartners: transportCount,
      openTruckBookings: openBookings,
    },
  }
}

export async function upsertProfile(
  hubId: string,
  input: {
    photoUrl?: string | null
    description?: string | null
    managerName: string
    managerPhone: string
    address: string
    city: string
    state: string
    pincode: string
    isActive?: boolean
  }
) {
  await assertHub(hubId)
  return prisma.hubProfile.upsert({
    where: { hubId },
    create: {
      hubId,
      managerName: input.managerName,
      managerPhone: input.managerPhone,
      address: input.address,
      city: input.city,
      state: input.state,
      pincode: input.pincode,
      photoUrl: input.photoUrl ?? undefined,
      description: input.description ?? undefined,
      isActive: input.isActive ?? true,
    },
    update: {
      managerName: input.managerName,
      managerPhone: input.managerPhone,
      address: input.address,
      city: input.city,
      state: input.state,
      pincode: input.pincode,
      photoUrl: input.photoUrl === undefined ? undefined : input.photoUrl,
      description: input.description === undefined ? undefined : input.description,
      isActive: input.isActive,
    },
  })
}

export async function listPendingParcels(hubId: string, q: { search?: string }) {
  await assertHub(hubId)
  const where = {
    currentHubId: hubId,
    status: { in: PENDING_AT_HUB },
    ...(q.search?.trim()
      ? {
          OR: [
            { publicId: { contains: q.search.trim(), mode: 'insensitive' as const } },
            { qrCode: { contains: q.search.trim(), mode: 'insensitive' as const } },
          ],
        }
      : {}),
  }
  return prisma.order.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    take: 200,
    include: {
      seller: { include: { user: { select: { email: true } } } },
      customer: true,
      orderItems: { take: 1 },
      assignedWorker: { select: { id: true, displayName: true } },
    },
  })
}

export async function listDeliveredParcels(
  hubId: string,
  q: { search?: string; from?: Date; to?: Date }
) {
  await assertHub(hubId)
  const from = q.from ?? subDays(new Date(), 30)
  const to = q.to ?? new Date()
  const search = q.search?.trim()
  return prisma.order.findMany({
    where: {
      status: OrderStatus.DELIVERED,
      updatedAt: { gte: from, lte: to },
      OR: [{ destinationHubId: hubId }, { sourceHubId: hubId }, { currentHubId: hubId }],
      ...(search
        ? {
            OR: [
              { publicId: { contains: search, mode: 'insensitive' as const } },
              { qrCode: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    },
    orderBy: { updatedAt: 'desc' },
    take: 500,
    include: {
      seller: { include: { user: { select: { email: true } } } },
      orderItems: { take: 1 },
      assignedWorker: { select: { displayName: true } },
    },
  })
}

export async function parcelStats(hubId: string) {
  await assertHub(hubId)
  const now = new Date()
  const today0 = startOfDay(now)
  const week0 = subDays(today0, 7)
  const month0 = subDays(today0, 30)
  const hubScope = {
    OR: [
      { destinationHubId: hubId },
      { sourceHubId: hubId },
      { currentHubId: hubId },
    ],
  }
  const [todayCount, weekCount, monthCount, revenueAgg] = await Promise.all([
    prisma.order.count({
      where: {
        status: OrderStatus.DELIVERED,
        updatedAt: { gte: today0 },
        ...hubScope,
      },
    }),
    prisma.order.count({
      where: {
        status: OrderStatus.DELIVERED,
        updatedAt: { gte: week0 },
        ...hubScope,
      },
    }),
    prisma.order.count({
      where: {
        status: OrderStatus.DELIVERED,
        updatedAt: { gte: month0 },
        ...hubScope,
      },
    }),
    prisma.order.aggregate({
      where: {
        status: OrderStatus.DELIVERED,
        updatedAt: { gte: month0 },
        ...hubScope,
      },
      _sum: { codAmountCents: true },
    }),
  ])
  const totalRevenue = (revenueAgg._sum.codAmountCents ?? 0) / 100
  return { todayCount, weekCount, monthCount, totalRevenue }
}

export async function listGigWorkers(hubId: string) {
  await assertHub(hubId)
  return prisma.hubWorkerAssignment.findMany({
    where: { hubId },
    include: {
      worker: {
        include: {
          _count: { select: { assignedOrders: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })
}

export async function addGigWorker(
  hubId: string,
  input: {
    workerId?: string
    displayName?: string
    phone?: string
    gigRole: HubGigRole
  }
) {
  await assertHub(hubId)
  let workerId = input.workerId
  if (!workerId) {
    const name = input.displayName?.trim()
    const phone = input.phone?.trim()
    if (!name || !phone) throw new HttpError(422, 'displayName and phone are required when workerId is omitted')
    const workerRole =
      input.gigRole === HubGigRole.PICKUP ? WorkerRole.PICKUP_AGENT : WorkerRole.COURIER
    const w = await prisma.worker.create({
      data: {
        displayName: name,
        phone,
        role: workerRole,
        homeHubId: hubId,
        isActive: true,
      },
    })
    workerId = w.id
  } else {
    const w = await prisma.worker.findUnique({ where: { id: workerId } })
    if (!w) throw new HttpError(404, 'Worker not found')
  }
  try {
    return await prisma.hubWorkerAssignment.create({
      data: { hubId, workerId, gigRole: input.gigRole },
      include: { worker: true },
    })
  } catch (e: unknown) {
    if (e && typeof e === 'object' && 'code' in e && (e as { code: string }).code === 'P2002') {
      throw new HttpError(409, 'Worker already assigned to this hub')
    }
    throw e
  }
}

export async function removeGigWorker(hubId: string, workerId: string) {
  await assertHub(hubId)
  const res = await prisma.hubWorkerAssignment.deleteMany({ where: { hubId, workerId } })
  if (res.count === 0) throw new HttpError(404, 'Assignment not found')
  return { ok: true }
}

export async function listBusServices(hubId: string) {
  await assertHub(hubId)
  return prisma.busServicePartner.findMany({
    where: { hubId },
    orderBy: { createdAt: 'desc' },
  })
}

export async function createBusService(
  hubId: string,
  data: {
    driverName: string
    driverPhone: string
    busNumber: string
    busType: string
    routeFrom: string
    routeTo: string
    departureTimes: string[]
    pricePerParcel?: number
    maxParcels?: number
    photoUrl?: string | null
    isActive?: boolean
  }
) {
  await assertHub(hubId)
  return prisma.busServicePartner.create({
    data: {
      hubId,
      driverName: data.driverName,
      driverPhone: data.driverPhone,
      busNumber: data.busNumber,
      busType: data.busType,
      routeFrom: data.routeFrom,
      routeTo: data.routeTo,
      departureTimes: data.departureTimes,
      pricePerParcel: data.pricePerParcel ?? 40,
      maxParcels: data.maxParcels ?? 50,
      photoUrl: data.photoUrl ?? undefined,
      isActive: data.isActive ?? true,
    },
  })
}

export async function updateBusService(
  hubId: string,
  id: string,
  data: {
    driverName?: string
    driverPhone?: string
    busNumber?: string
    busType?: string
    routeFrom?: string
    routeTo?: string
    departureTimes?: string[]
    pricePerParcel?: number
    maxParcels?: number
    photoUrl?: string | null
    isActive?: boolean
  }
) {
  await assertHub(hubId)
  const row = await prisma.busServicePartner.findFirst({ where: { id, hubId } })
  if (!row) throw new HttpError(404, 'Bus service not found')
  return prisma.busServicePartner.update({ where: { id }, data })
}

export async function deleteBusService(hubId: string, id: string) {
  await assertHub(hubId)
  const res = await prisma.busServicePartner.deleteMany({ where: { id, hubId } })
  if (res.count === 0) throw new HttpError(404, 'Bus service not found')
  return { ok: true }
}

export async function toggleBusService(hubId: string, id: string) {
  await assertHub(hubId)
  const row = await prisma.busServicePartner.findFirst({ where: { id, hubId } })
  if (!row) throw new HttpError(404, 'Bus service not found')
  return prisma.busServicePartner.update({
    where: { id },
    data: { isActive: !row.isActive },
  })
}

export async function listTransportPartners(hubId: string) {
  await assertHub(hubId)
  return prisma.transportPartner.findMany({
    where: { hubId },
    include: {
      trucks: true,
    },
    orderBy: { createdAt: 'desc' },
  })
}

export async function createTransportPartner(
  hubId: string,
  data: {
    ownerName: string
    ownerPhone: string
    ownerPhone2?: string | null
    address: string
    city: string
    photoUrl?: string | null
    isVerified?: boolean
    trucks?: Array<{
      truckNumber: string
      truckType: string
      capacityTons: number
      photoUrl?: string | null
      ownershipType: TruckOwnership
      commissionPercent?: number | null
    }>
  }
) {
  await assertHub(hubId)
  const { trucks, ...rest } = data
  return prisma.transportPartner.create({
    data: {
      hubId,
      ownerName: rest.ownerName,
      ownerPhone: rest.ownerPhone,
      ownerPhone2: rest.ownerPhone2 ?? undefined,
      address: rest.address,
      city: rest.city,
      photoUrl: rest.photoUrl ?? undefined,
      isVerified: rest.isVerified ?? false,
      trucks: trucks?.length
        ? {
            create: trucks.map((t) => {
              const own = t.ownershipType === 'OWN'
              return {
                truckNumber: t.truckNumber,
                truckType: t.truckType,
                capacityTons: t.capacityTons,
                photoUrl: t.photoUrl ?? undefined,
                ownershipType: own ? TruckOwnership.OWN : TruckOwnership.COMMISSION,
                commissionPercent: !own ? t.commissionPercent ?? undefined : null,
              }
            }),
          }
        : undefined,
    },
    include: { trucks: true },
  })
}

export async function updateTransportPartner(
  hubId: string,
  id: string,
  data: {
    ownerName?: string
    ownerPhone?: string
    ownerPhone2?: string | null
    address?: string
    city?: string
    photoUrl?: string | null
    isVerified?: boolean
    isActive?: boolean
  }
) {
  await assertHub(hubId)
  const row = await prisma.transportPartner.findFirst({ where: { id, hubId } })
  if (!row) throw new HttpError(404, 'Transport partner not found')
  return prisma.transportPartner.update({ where: { id }, data })
}

export async function deleteTransportPartner(hubId: string, id: string) {
  await assertHub(hubId)
  const res = await prisma.transportPartner.deleteMany({ where: { id, hubId } })
  if (res.count === 0) throw new HttpError(404, 'Transport partner not found')
  return { ok: true }
}

export async function listTrucks(hubId: string, partnerId: string) {
  await assertHub(hubId)
  const p = await prisma.transportPartner.findFirst({ where: { id: partnerId, hubId } })
  if (!p) throw new HttpError(404, 'Transport partner not found')
  return prisma.truck.findMany({
    where: { transportPartnerId: partnerId },
    orderBy: { createdAt: 'desc' },
  })
}

export async function createTruck(
  hubId: string,
  partnerId: string,
  data: {
    truckNumber: string
    truckType: string
    capacityTons: number
    photoUrl?: string | null
    ownershipType: TruckOwnership | 'OWN' | 'COMMISSION'
    commissionPercent?: number | null
  }
) {
  const p = await prisma.transportPartner.findFirst({ where: { id: partnerId, hubId } })
  if (!p) throw new HttpError(404, 'Transport partner not found')
  const own = String(data.ownershipType) === 'OWN'
  const ownershipType = own ? TruckOwnership.OWN : TruckOwnership.COMMISSION
  if (!own && (data.commissionPercent == null || data.commissionPercent <= 0)) {
    throw new HttpError(422, 'commissionPercent is required for COMMISSION trucks')
  }
  return prisma.truck.create({
    data: {
      transportPartnerId: partnerId,
      truckNumber: data.truckNumber,
      truckType: data.truckType,
      capacityTons: data.capacityTons,
      photoUrl: data.photoUrl ?? undefined,
      ownershipType,
      commissionPercent: !own ? data.commissionPercent ?? undefined : null,
    },
  })
}

export async function updateTruck(
  hubId: string,
  partnerId: string,
  truckId: string,
  data: {
    truckNumber?: string
    truckType?: string
    capacityTons?: number
    photoUrl?: string | null
    ownershipType?: TruckOwnership | 'OWN' | 'COMMISSION'
    commissionPercent?: number | null
    isActive?: boolean
  }
) {
  const truck = await prisma.truck.findFirst({
    where: { id: truckId, transportPartnerId: partnerId, partner: { hubId } },
  })
  if (!truck) throw new HttpError(404, 'Truck not found')
  const d: Prisma.TruckUpdateInput = {}
  if (data.truckNumber !== undefined) d.truckNumber = data.truckNumber
  if (data.truckType !== undefined) d.truckType = data.truckType
  if (data.capacityTons !== undefined) d.capacityTons = data.capacityTons
  if (data.photoUrl !== undefined) d.photoUrl = data.photoUrl
  if (data.isActive !== undefined) d.isActive = data.isActive
  if (data.ownershipType !== undefined) {
    const own = String(data.ownershipType) === 'OWN'
    d.ownershipType = own ? TruckOwnership.OWN : TruckOwnership.COMMISSION
    d.commissionPercent = own ? null : data.commissionPercent ?? undefined
  } else if (data.commissionPercent !== undefined) {
    d.commissionPercent = data.commissionPercent
  }
  return prisma.truck.update({ where: { id: truckId }, data: d })
}

export async function toggleTruck(hubId: string, partnerId: string, truckId: string) {
  const truck = await prisma.truck.findFirst({
    where: { id: truckId, transportPartnerId: partnerId, partner: { hubId } },
  })
  if (!truck) throw new HttpError(404, 'Truck not found')
  return prisma.truck.update({
    where: { id: truckId },
    data: { isActive: !truck.isActive },
  })
}

export async function listPartnerTruckBookings(hubId: string) {
  await assertHub(hubId)
  return prisma.partnerTruckBooking.findMany({
    where: { bookedByHubId: hubId },
    include: { truck: { include: { partner: true } } },
    orderBy: { scheduledDate: 'desc' },
    take: 200,
  })
}

export async function createPartnerTruckBooking(
  hubId: string,
  input: {
    truckId: string
    customerName: string
    customerPhone: string
    pickupAddress: string
    deliveryAddress: string
    goodsType: string
    weightTons: number
    agreedPrice: number
    scheduledDate: Date
    notes?: string | null
  }
) {
  await assertHub(hubId)
  const truck = await prisma.truck.findFirst({
    where: { id: input.truckId, partner: { hubId } },
  })
  if (!truck) throw new HttpError(404, 'Truck not found for this hub')
  const appCommission = Math.round(input.agreedPrice * 100 * 0.06) / 100
  return prisma.partnerTruckBooking.create({
    data: {
      truckId: input.truckId,
      bookedByHubId: hubId,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      pickupAddress: input.pickupAddress,
      deliveryAddress: input.deliveryAddress,
      goodsType: input.goodsType,
      weightTons: input.weightTons,
      agreedPrice: input.agreedPrice,
      appCommission,
      scheduledDate: input.scheduledDate,
      notes: input.notes ?? undefined,
    },
  })
}

export async function patchPartnerTruckBookingStatus(
  hubId: string,
  bookingId: string,
  status: PartnerTruckBookingStatus
) {
  const b = await prisma.partnerTruckBooking.findFirst({
    where: { id: bookingId, bookedByHubId: hubId },
  })
  if (!b) throw new HttpError(404, 'Booking not found')
  return prisma.partnerTruckBooking.update({
    where: { id: bookingId },
    data: { status },
  })
}
