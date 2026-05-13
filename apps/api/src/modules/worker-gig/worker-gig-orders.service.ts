import { OrderStatus, OtpType, ScanEvent } from '@prisma/client'
import { prisma } from '../../lib/prisma.js'
import { HttpError } from '../../lib/http-error.js'
import { domainEvents } from '../../lib/events.js'
import { getIo } from '../../lib/realtime.js'
import { maskPhone, randomSixDigitOtp } from './worker-gig.utils.js'

const PLACEHOLDER_SCAN_PHOTO = 'https://static.local/scan-placeholder'

function defaultPickupCents(order: { pickupWorkerEarningCents: number | null }) {
  return order.pickupWorkerEarningCents ?? 3000
}

function defaultDeliveryCents(order: { deliveryWorkerEarningCents: number | null }) {
  return order.deliveryWorkerEarningCents ?? 3000
}

async function sellerPhone(order: {
  seller: { user: { phone: string | null } | null }
}) {
  const p = order.seller.user?.phone?.replace(/\D/g, '') ?? ''
  if (!p) throw new HttpError(400, 'Seller phone not available for OTP')
  return p
}

async function loadOrderForWorker(orderId: string, workerId: string) {
  const order = await prisma.order.findFirst({
    where: {
      OR: [{ id: orderId }, { publicId: orderId }],
      AND: {
        OR: [{ pickupWorkerId: workerId }, { assignedWorkerId: workerId }],
      },
    },
    include: {
      seller: { include: { user: true } },
      customer: true,
      orderItems: true,
      pickupLocation: true,
      deliveryLocation: true,
      pickupWorker: true,
      assignedWorker: true,
      sourceHub: true,
      destinationHub: true,
    },
  })
  if (!order) throw new HttpError(404, 'Order not found')
  return order
}

export async function getOrderDetail(orderId: string, workerId: string) {
  return loadOrderForWorker(orderId, workerId)
}

export async function pickupInit(orderId: string, workerId: string) {
  const order = await loadOrderForWorker(orderId, workerId)
  if (order.pickupWorkerId !== workerId) {
    throw new HttpError(403, 'Not assigned pickup worker')
  }
  if (order.status !== OrderStatus.PICKUP_ASSIGNED) {
    throw new HttpError(400, 'Order not in PICKUP_ASSIGNED state')
  }
  const phone = await sellerPhone(order as never)
  const otp = randomSixDigitOtp()
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000)
  const session = await prisma.workerOtpSession.create({
    data: {
      orderId: order.id,
      otpType: OtpType.PICKUP_FROM_SELLER,
      otp,
      phone,
      expiresAt,
    },
  })
  console.log(`[pickup] SELLER OTP for order ${order.id}: ${otp}`)
  return {
    sessionId: session.id,
    sellerPhone: maskPhone(phone),
    message: 'OTP sent to seller',
  }
}

export async function pickupScan(input: {
  orderId: string
  workerId: string
  qrCode: string
  photoUrl: string
  lat: number
  lng: number
}) {
  if (!input.photoUrl?.trim()) {
    throw new HttpError(400, 'photoUrl is required')
  }
  const order = await loadOrderForWorker(input.orderId, input.workerId)
  if (order.pickupWorkerId !== input.workerId) {
    throw new HttpError(403, 'Not pickup worker')
  }
  if (order.status !== OrderStatus.PICKUP_ASSIGNED) {
    throw new HttpError(400, 'Invalid order status for pickup scan')
  }
  if (input.qrCode.trim() !== order.qrCode) {
    throw new HttpError(400, 'QR code does not match')
  }

  const productName = order.orderItems[0]?.title ?? 'Parcel'
  const sellerName = order.seller.companyName ?? 'Seller'

  await prisma.$transaction(async (tx) => {
    await tx.orderPhoto.create({
      data: {
        orderId: order.id,
        url: input.photoUrl,
        kind: 'PICKUP_FROM_SELLER',
        uploadedByWorkerId: input.workerId,
      },
    })
    await tx.scanLog.create({
      data: {
        orderId: order.id,
        event: ScanEvent.PICKUP_SCAN,
        qrCode: order.qrCode,
        workerId: input.workerId,
        photoUrl: input.photoUrl,
        latitude: input.lat,
        longitude: input.lng,
        scannedAt: new Date(),
      },
    })
    await tx.order.update({
      where: { id: order.id },
      data: { status: OrderStatus.PICKUP_SCANNED },
    })
  })

  domainEvents.emit('order:status:changed', {
    orderId: order.id,
    publicId: order.publicId,
    from: OrderStatus.PICKUP_ASSIGNED,
    to: OrderStatus.PICKUP_SCANNED,
  })

  return { success: true, productName, sellerName }
}

export async function pickupVerifyOtp(input: {
  orderId: string
  workerId: string
  sessionId: string
  otp: string
}) {
  const order = await loadOrderForWorker(input.orderId, input.workerId)
  if (order.pickupWorkerId !== input.workerId) {
    throw new HttpError(403, 'Not pickup worker')
  }
  if (order.status !== OrderStatus.PICKUP_SCANNED) {
    throw new HttpError(400, 'Order not awaiting seller OTP')
  }

  const session = await prisma.workerOtpSession.findFirst({
    where: {
      id: input.sessionId,
      orderId: order.id,
      otpType: OtpType.PICKUP_FROM_SELLER,
    },
  })
  if (
    !session ||
    session.isUsed ||
    session.expiresAt < new Date() ||
    session.otp !== input.otp.trim()
  ) {
    throw new HttpError(400, 'Invalid or expired OTP')
  }

  await prisma.$transaction(async (tx) => {
    await tx.workerOtpSession.update({
      where: { id: session.id },
      data: { isUsed: true, usedAt: new Date() },
    })
    await tx.scanLog.create({
      data: {
        orderId: order.id,
        event: ScanEvent.SELLER_CONFIRM,
        qrCode: order.qrCode,
        workerId: input.workerId,
        photoUrl: PLACEHOLDER_SCAN_PHOTO,
        latitude: order.pickupLat ?? 0,
        longitude: order.pickupLng ?? 0,
        scannedAt: new Date(),
      },
    })
    await tx.order.update({
      where: { id: order.id },
      data: { status: OrderStatus.SELLER_CONFIRMED },
    })
    const exists = await tx.workerEarning.findFirst({
      where: {
        orderId: order.id,
        workerId: input.workerId,
        kind: 'PICKUP',
      },
    })
    if (!exists) {
      await tx.workerEarning.create({
        data: {
          workerId: input.workerId,
          orderId: order.id,
          amountCents: defaultPickupCents(order),
          kind: 'PICKUP',
          note: 'Pickup confirmed at seller',
        },
      })
    }
  })

  domainEvents.emit('order:status:changed', {
    orderId: order.id,
    publicId: order.publicId,
    from: OrderStatus.PICKUP_SCANNED,
    to: OrderStatus.SELLER_CONFIRMED,
  })

  getIo()?.to(`seller:${order.sellerId}`).emit('order:pickup_confirmed', {
    orderId: order.id,
    publicId: order.publicId,
    workerName: order.pickupWorker?.displayName ?? 'Driver',
    estimatedHubArrival: null,
  })

  return { success: true, message: 'Pickup confirmed, go to hub' }
}

export async function hubDropInit(input: {
  orderId: string
  workerId: string
  hubId: string
  lat: number
  lng: number
}) {
  const order = await loadOrderForWorker(input.orderId, input.workerId)
  if (order.pickupWorkerId !== input.workerId) {
    throw new HttpError(403, 'Not pickup worker')
  }
  if (order.status !== OrderStatus.SELLER_CONFIRMED) {
    throw new HttpError(400, 'Order must be SELLER_CONFIRMED')
  }
  const profile = await prisma.hubProfile.findUnique({
    where: { hubId: input.hubId },
  })
  if (!profile) throw new HttpError(404, 'Hub profile not found')
  const phone = profile.managerPhone.replace(/\D/g, '')
  if (phone.length < 8) throw new HttpError(400, 'Invalid hub manager phone')

  const otp = randomSixDigitOtp()
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000)
  const session = await prisma.workerOtpSession.create({
    data: {
      orderId: order.id,
      hubId: input.hubId,
      otpType: OtpType.DROP_AT_HUB,
      otp,
      phone,
      expiresAt,
    },
  })
  console.log(`[hub-drop] HUB DROP OTP for order ${order.id}: ${otp}`)
  return { sessionId: session.id, message: 'OTP sent to hub manager' }
}

export async function hubDropVerifyOtp(input: {
  orderId: string
  workerId: string
  sessionId: string
  otp: string
  hubStaffId: string
}) {
  const order = await loadOrderForWorker(input.orderId, input.workerId)
  if (order.pickupWorkerId !== input.workerId) {
    throw new HttpError(403, 'Not pickup worker')
  }
  const session = await prisma.workerOtpSession.findFirst({
    where: { id: input.sessionId, orderId: order.id, otpType: OtpType.DROP_AT_HUB },
  })
  if (
    !session ||
    session.isUsed ||
    session.expiresAt < new Date() ||
    session.otp !== input.otp.trim()
  ) {
    throw new HttpError(400, 'Invalid or expired OTP')
  }
  const hubId = session.hubId
  if (!hubId) throw new HttpError(400, 'Session missing hub')

  const staff = await prisma.worker.findUnique({ where: { id: input.hubStaffId } })
  if (!staff) throw new HttpError(404, 'Hub staff worker not found')

  await prisma.$transaction(async (tx) => {
    await tx.workerOtpSession.update({
      where: { id: session.id },
      data: { isUsed: true, usedAt: new Date() },
    })
    await tx.scanLog.create({
      data: {
        orderId: order.id,
        event: ScanEvent.HUB_DROP_SCAN,
        qrCode: order.qrCode,
        workerId: input.workerId,
        photoUrl: PLACEHOLDER_SCAN_PHOTO,
        latitude: order.pickupLat ?? 0,
        longitude: order.pickupLng ?? 0,
        hubId,
        scannedAt: new Date(),
      },
    })
    await tx.scanLog.create({
      data: {
        orderId: order.id,
        event: ScanEvent.HUB_ACCEPT,
        qrCode: order.qrCode,
        workerId: input.hubStaffId,
        photoUrl: PLACEHOLDER_SCAN_PHOTO,
        latitude: order.pickupLat ?? 0,
        longitude: order.pickupLng ?? 0,
        hubId,
        scannedAt: new Date(),
      },
    })
    await tx.order.update({
      where: { id: order.id },
      data: {
        status: OrderStatus.AT_SOURCE_HUB,
        sourceHubId: hubId,
        currentHubId: hubId,
        atSourceHubAt: new Date(),
      },
    })
  })

  domainEvents.emit('order:status:changed', {
    orderId: order.id,
    publicId: order.publicId,
    from: OrderStatus.SELLER_CONFIRMED,
    to: OrderStatus.AT_SOURCE_HUB,
  })

  return { success: true, message: 'Package received at hub' }
}

export async function deliveryInit(input: {
  orderId: string
  workerId: string
  lat: number
  lng: number
}) {
  const order = await loadOrderForWorker(input.orderId, input.workerId)
  if (order.assignedWorkerId !== input.workerId) {
    throw new HttpError(403, 'Not assigned delivery worker')
  }
  if (
    order.status !== OrderStatus.DELIVERY_ASSIGNED &&
    order.status !== OrderStatus.AT_DESTINATION_HUB
  ) {
    throw new HttpError(400, 'Order not ready for delivery start')
  }
  if (!order.customer?.phone) throw new HttpError(400, 'Customer phone missing')

  const phone = order.customer.phone.replace(/\D/g, '')
  const otp = randomSixDigitOtp()
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000)
  const session = await prisma.workerOtpSession.create({
    data: {
      orderId: order.id,
      otpType: OtpType.DELIVERY_TO_CUSTOMER,
      otp,
      phone,
      expiresAt,
    },
  })
  console.log(`[delivery] CUSTOMER OTP for order ${order.id}: ${otp}`)

  await prisma.$transaction(async (tx) => {
    const hasPickupScan = await tx.scanLog.findFirst({
      where: { orderId: order.id, event: ScanEvent.DELIVERY_SCAN },
    })
    if (!hasPickupScan) {
      await tx.scanLog.create({
        data: {
          orderId: order.id,
          event: ScanEvent.DELIVERY_SCAN,
          qrCode: order.qrCode,
          workerId: input.workerId,
          photoUrl: PLACEHOLDER_SCAN_PHOTO,
          latitude: input.lat,
          longitude: input.lng,
          scannedAt: new Date(),
        },
      })
    }
    await tx.order.update({
      where: { id: order.id },
      data: { status: OrderStatus.OUT_FOR_DELIVERY },
    })
  })

  domainEvents.emit('order:status:changed', {
    orderId: order.id,
    publicId: order.publicId,
    from: order.status,
    to: OrderStatus.OUT_FOR_DELIVERY,
  })

  const addr =
    order.deliveryLocation?.line1 ??
    order.destinationAddress ??
    'Address on file'

  return {
    sessionId: session.id,
    customerPhone: maskPhone(phone),
    deliveryAddress: addr,
  }
}

export async function deliveryScan(input: {
  orderId: string
  workerId: string
  qrCode: string
  photoUrl: string
  lat: number
  lng: number
}) {
  if (!input.photoUrl?.trim()) throw new HttpError(400, 'photoUrl is required')
  const order = await loadOrderForWorker(input.orderId, input.workerId)
  if (order.assignedWorkerId !== input.workerId) {
    throw new HttpError(403, 'Not delivery worker')
  }
  if (input.qrCode.trim() !== order.qrCode) {
    throw new HttpError(400, 'QR mismatch')
  }

  await prisma.orderPhoto.create({
    data: {
      orderId: order.id,
      url: input.photoUrl,
      kind: 'DELIVERED_TO_CUSTOMER',
      uploadedByWorkerId: input.workerId,
    },
  })

  const has = await prisma.scanLog.findFirst({
    where: { orderId: order.id, event: ScanEvent.DELIVERY_SCAN },
  })
  if (!has) {
    await prisma.scanLog.create({
      data: {
        orderId: order.id,
        event: ScanEvent.DELIVERY_SCAN,
        qrCode: order.qrCode,
        workerId: input.workerId,
        photoUrl: input.photoUrl,
        latitude: input.lat,
        longitude: input.lng,
        scannedAt: new Date(),
      },
    })
  }

  return { success: true }
}

export async function deliveryVerifyOtp(input: {
  orderId: string
  workerId: string
  sessionId: string
  otp: string
}) {
  const order = await loadOrderForWorker(input.orderId, input.workerId)
  if (order.assignedWorkerId !== input.workerId) {
    throw new HttpError(403, 'Not delivery worker')
  }
  if (order.status !== OrderStatus.OUT_FOR_DELIVERY) {
    throw new HttpError(400, 'Order must be OUT_FOR_DELIVERY')
  }

  const session = await prisma.workerOtpSession.findFirst({
    where: {
      id: input.sessionId,
      orderId: order.id,
      otpType: OtpType.DELIVERY_TO_CUSTOMER,
    },
  })
  if (
    !session ||
    session.isUsed ||
    session.expiresAt < new Date() ||
    session.otp !== input.otp.trim()
  ) {
    throw new HttpError(400, 'Invalid or expired OTP')
  }

  const deliveryCents = defaultDeliveryCents(order)
  const pickupCents = order.pickupWorkerId
    ? defaultPickupCents(order)
    : 0

  await prisma.$transaction(async (tx) => {
    await tx.workerOtpSession.update({
      where: { id: session.id },
      data: { isUsed: true, usedAt: new Date() },
    })
    await tx.scanLog.create({
      data: {
        orderId: order.id,
        event: ScanEvent.DELIVERED,
        qrCode: order.qrCode,
        workerId: input.workerId,
        photoUrl: PLACEHOLDER_SCAN_PHOTO,
        latitude: order.destinationLat ?? 0,
        longitude: order.destinationLng ?? 0,
        scannedAt: new Date(),
      },
    })
    await tx.order.update({
      where: { id: order.id },
      data: {
        status: OrderStatus.DELIVERED,
        deliveredAt: new Date(),
        otpVerified: true,
      },
    })

    if (order.pickupWorkerId) {
      const pe = await tx.workerEarning.findFirst({
        where: {
          orderId: order.id,
          workerId: order.pickupWorkerId,
          kind: 'PICKUP',
        },
      })
      if (!pe) {
        await tx.workerEarning.create({
          data: {
            workerId: order.pickupWorkerId,
            orderId: order.id,
            amountCents: pickupCents,
            kind: 'PICKUP',
            note: 'Pickup earning (on delivery close)',
          },
        })
      }
    }

    const de = await tx.workerEarning.findFirst({
      where: {
        orderId: order.id,
        workerId: input.workerId,
        kind: 'DELIVERY',
      },
    })
    if (!de) {
      await tx.workerEarning.create({
        data: {
          workerId: input.workerId,
          orderId: order.id,
          amountCents: deliveryCents,
          kind: 'DELIVERY',
          note: 'Delivery completed',
        },
      })
    }
  })

  const fresh = await prisma.order.findUniqueOrThrow({ where: { id: order.id } })
  domainEvents.emit('order:status:changed', {
    orderId: order.id,
    publicId: order.publicId,
    from: OrderStatus.OUT_FOR_DELIVERY,
    to: OrderStatus.DELIVERED,
  })

  const deliveredAt = fresh.deliveredAt?.toISOString() ?? new Date().toISOString()
  const io = getIo()
  io?.to(`seller:${order.sellerId}`).emit('order:delivered', {
    orderId: order.id,
    publicId: order.publicId,
    deliveredAt,
  })
  if (order.customerId) {
    io?.to(`customer:${order.customerId}`).emit('order:delivered', {
      orderId: order.id,
      publicId: order.publicId,
      deliveredAt,
    })
  }

  return {
    success: true,
    message: `Delivered! ₹${(deliveryCents / 100).toFixed(0)} credited`,
  }
}
