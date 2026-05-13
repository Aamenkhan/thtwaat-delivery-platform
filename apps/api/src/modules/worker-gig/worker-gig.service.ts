import {
  OrderStatus,
  OtpType,
  Role,
  WorkerRole,
} from '@prisma/client'
import { prisma } from '../../lib/prisma.js'
import { HttpError } from '../../lib/http-error.js'
import { signWorkerJwt } from '../../lib/worker-jwt.js'
import { getIo } from '../../lib/realtime.js'
import { maskPhone, randomSixDigitOtp, regOrderId } from './worker-gig.utils.js'

function mapAppRoleFromGigRole(wr: WorkerRole): Role {
  if (wr === WorkerRole.PICKUP_AGENT) return Role.WORKER
  return Role.DELIVERY_WORKER
}

function mapBodyRoleToWorkerRole(
  role: string
): { workerRole: WorkerRole; appRole: Role } {
  const r = role.toUpperCase()
  if (r === 'PICKUP_WORKER' || r === 'PICKUP_AGENT' || r === 'PICKUP') {
    return { workerRole: WorkerRole.PICKUP_AGENT, appRole: Role.WORKER }
  }
  if (r === 'DELIVERY_WORKER' || r === 'COURIER' || r === 'DELIVERY') {
    return { workerRole: WorkerRole.COURIER, appRole: Role.DELIVERY_WORKER }
  }
  throw new HttpError(400, 'Invalid role')
}

export async function registerWorker(input: {
  name: string
  phone: string
  role: string
  hubId: string
  address?: string
  city?: string
  pincode?: string
  vehicleNumber?: string
  vehicleType?: string
}) {
  const hub = await prisma.hub.findUnique({ where: { id: input.hubId } })
  if (!hub) throw new HttpError(404, 'Hub not found')

  const phone = input.phone.replace(/\D/g, '')
  if (phone.length < 10) throw new HttpError(400, 'Invalid phone')

  const { workerRole } = mapBodyRoleToWorkerRole(input.role)

  const worker = await prisma.worker.create({
    data: {
      displayName: input.name.trim(),
      phone,
      role: workerRole,
      homeHubId: input.hubId,
      address: input.address?.trim(),
      city: input.city?.trim(),
      pincode: input.pincode?.trim(),
      vehicleNumber: input.vehicleNumber?.trim().toUpperCase(),
      vehicleType: input.vehicleType?.trim(),
    },
  })

  const otp = randomSixDigitOtp()
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000)

  await prisma.workerOtpSession.create({
    data: {
      orderId: regOrderId(worker.id),
      otpType: OtpType.PICKUP_FROM_SELLER,
      otp,
      phone,
      expiresAt,
      workerId: worker.id,
    },
  })

  console.log(`[worker-register] OTP for ${phone} worker ${worker.id}: ${otp}`)

  return {
    workerId: worker.id,
    message: `OTP sent to ${maskPhone(phone)}`,
  }
}

export async function verifyWorkerPhone(input: { workerId: string; otp: string }) {
  const worker = await prisma.worker.findUnique({ where: { id: input.workerId } })
  if (!worker?.phone) throw new HttpError(404, 'Worker not found')

  const session = await prisma.workerOtpSession.findFirst({
    where: {
      workerId: worker.id,
      orderId: regOrderId(worker.id),
      otpType: OtpType.PICKUP_FROM_SELLER,
      isUsed: false,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  })
  if (!session || session.otp !== input.otp.trim()) {
    throw new HttpError(400, 'Invalid or expired OTP')
  }

  await prisma.workerOtpSession.update({
    where: { id: session.id },
    data: { isUsed: true, usedAt: new Date() },
  })

  return finalizeWorkerToken(worker)
}

export function loginOrderId(phoneDigits: string) {
  return `login:${phoneDigits}`
}

export async function requestLoginOtp(phoneRaw: string) {
  const phone = phoneRaw.replace(/\D/g, '')
  if (phone.length < 10) throw new HttpError(400, 'Invalid phone')
  const worker = await prisma.worker.findFirst({
    where: { phone },
    orderBy: { createdAt: 'desc' },
  })
  if (!worker) throw new HttpError(404, 'No worker for this phone')

  const otp = randomSixDigitOtp()
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000)
  await prisma.workerOtpSession.create({
    data: {
      orderId: loginOrderId(phone),
      otpType: OtpType.PICKUP_FROM_SELLER,
      otp,
      phone,
      expiresAt,
      workerId: worker.id,
    },
  })
  console.log(`[worker-login] OTP for ${phone}: ${otp}`)
  return { message: `OTP sent to ${maskPhone(phone)}` }
}

export async function verifyLoginOtp(input: { phone: string; otp: string }) {
  const phone = input.phone.replace(/\D/g, '')
  const session = await prisma.workerOtpSession.findFirst({
    where: {
      orderId: loginOrderId(phone),
      otpType: OtpType.PICKUP_FROM_SELLER,
      isUsed: false,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  })
  if (!session || session.otp !== input.otp.trim() || !session.workerId) {
    throw new HttpError(400, 'Invalid or expired OTP')
  }
  await prisma.workerOtpSession.update({
    where: { id: session.id },
    data: { isUsed: true, usedAt: new Date() },
  })
  const worker = await prisma.worker.findUniqueOrThrow({
    where: { id: session.workerId },
  })
  return finalizeWorkerToken(worker)
}

function finalizeWorkerToken(worker: {
  id: string
  homeHubId: string | null
  role: WorkerRole
  displayName: string
  phone: string | null
}) {
  const token = signWorkerJwt({
    workerId: worker.id,
    hubId: worker.homeHubId,
    appRole: mapAppRoleFromGigRole(worker.role),
    workerRole: worker.role,
  })
  return {
    success: true,
    token,
    worker: {
      id: worker.id,
      displayName: worker.displayName,
      phone: worker.phone,
      role: worker.role,
      hubId: worker.homeHubId,
    },
  }
}

export async function getWorkerProfile(workerId: string) {
  const worker = await prisma.worker.findUnique({
    where: { id: workerId },
    include: { homeHub: true },
  })
  if (!worker) throw new HttpError(404, 'Worker not found')

  const startDay = new Date()
  startDay.setHours(0, 0, 0, 0)
  const startMonth = new Date()
  startMonth.setDate(1)
  startMonth.setHours(0, 0, 0, 0)

  const [todayAgg, monthAgg, pickupCount, deliveryCount] = await Promise.all([
    prisma.workerEarning.aggregate({
      where: { workerId, createdAt: { gte: startDay } },
      _sum: { amountCents: true },
    }),
    prisma.workerEarning.aggregate({
      where: { workerId, createdAt: { gte: startMonth } },
      _sum: { amountCents: true },
    }),
    prisma.order.count({
      where: {
        pickupWorkerId: workerId,
        status: { in: [OrderStatus.DELIVERED, OrderStatus.SELLER_CONFIRMED, OrderStatus.AT_SOURCE_HUB, OrderStatus.IN_TRANSIT, OrderStatus.AT_DESTINATION_HUB, OrderStatus.OUT_FOR_DELIVERY, OrderStatus.PICKUP_SCANNED, OrderStatus.PICKED_UP] },
      },
    }),
    prisma.order.count({
      where: { assignedWorkerId: workerId, status: OrderStatus.DELIVERED },
    }),
  ])

  return {
    ...worker,
    totalPickups: pickupCount,
    totalDeliveries: deliveryCount,
    rating: 4.9,
    todayEarnings: (todayAgg._sum.amountCents ?? 0) / 100,
    monthEarnings: (monthAgg._sum.amountCents ?? 0) / 100,
  }
}

export async function updateWorkerProfile(
  workerId: string,
  input: {
    name?: string
    address?: string
    city?: string
    pincode?: string
    vehicleNumber?: string
    vehicleType?: string
    upiId?: string
    aadhaarNumber?: string
    drivingLicenseNo?: string
    bankAccount?: string
    bankIfsc?: string
  }
) {
  return prisma.worker.update({
    where: { id: workerId },
    data: {
      displayName: input.name?.trim(),
      address: input.address?.trim(),
      city: input.city?.trim(),
      pincode: input.pincode?.trim(),
      vehicleNumber: input.vehicleNumber?.trim().toUpperCase(),
      vehicleType: input.vehicleType?.trim(),
      upiId: input.upiId?.trim(),
      aadhaarNumber: input.aadhaarNumber?.replace(/\D/g, ''),
      drivingLicenseNo: input.drivingLicenseNo?.trim(),
      bankAccount: input.bankAccount?.trim(),
      bankIfsc: input.bankIfsc?.trim().toUpperCase(),
    },
  })
}

export async function setWorkerOnlineStatus(input: {
  workerId: string
  isOnline: boolean
  lat?: number
  lng?: number
}) {
  const w = await prisma.worker.update({
    where: { id: input.workerId },
    data: {
      isOnline: input.isOnline,
      lastSeenAt: new Date(),
      lastLat: input.lat ?? undefined,
      lastLng: input.lng ?? undefined,
    },
  })
  const hubId = w.homeHubId
  if (hubId) {
    const io = getIo()
    const payload = {
      workerId: w.id,
      name: w.displayName,
      lat: w.lastLat,
      lng: w.lastLng,
      role: w.role,
    }
    if (input.isOnline) {
      io?.to(`hub:${hubId}`).emit('worker:online', payload)
    } else {
      io?.to(`hub:${hubId}`).emit('worker:offline', payload)
    }
  }
  return w
}

export async function recordWorkerLocation(input: {
  workerId: string
  lat: number
  lng: number
}) {
  const w = await prisma.worker.update({
    where: { id: input.workerId },
    data: {
      lastLat: input.lat,
      lastLng: input.lng,
      lastSeenAt: new Date(),
    },
  })
  const io = getIo()
  const ts = new Date().toISOString()
  if (w.homeHubId) {
    io?.to(`hub:${w.homeHubId}`).emit('worker:location', {
      workerId: w.id,
      lat: input.lat,
      lng: input.lng,
      timestamp: ts,
    })
  }
  const activeOrders = await prisma.order.findMany({
    where: {
      OR: [{ pickupWorkerId: w.id }, { assignedWorkerId: w.id }],
      status: {
        notIn: [
          OrderStatus.DELIVERED,
          OrderStatus.CANCELLED,
          OrderStatus.RETURN_COMPLETED,
        ],
      },
    },
    select: { publicId: true },
  })
  for (const o of activeOrders) {
    io?.to(`order:${o.publicId}`).emit('worker:location', {
      workerId: w.id,
      lat: input.lat,
      lng: input.lng,
      timestamp: ts,
    })
  }
  return { success: true }
}

export async function listWorkerOrders(workerId: string, mode: 'active' | 'completed_today') {
  const startDay = new Date()
  startDay.setHours(0, 0, 0, 0)

  if (mode === 'completed_today') {
    return prisma.order.findMany({
      where: {
        OR: [{ pickupWorkerId: workerId }, { assignedWorkerId: workerId }],
        status: OrderStatus.DELIVERED,
        updatedAt: { gte: startDay },
      },
      orderBy: { updatedAt: 'desc' },
      take: 50,
      include: {
        seller: true,
        customer: true,
        orderItems: { take: 1 },
        pickupLocation: true,
        deliveryLocation: true,
      },
    })
  }

  return prisma.order.findMany({
    where: {
      OR: [{ pickupWorkerId: workerId }, { assignedWorkerId: workerId }],
      status: {
        notIn: [
          OrderStatus.DELIVERED,
          OrderStatus.CANCELLED,
          OrderStatus.RETURN_COMPLETED,
        ],
      },
    },
    orderBy: { updatedAt: 'desc' },
    take: 30,
    include: {
      seller: true,
      customer: true,
      orderItems: { take: 1 },
      pickupLocation: true,
      deliveryLocation: true,
    },
  })
}
