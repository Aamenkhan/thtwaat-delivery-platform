import { createHash, randomInt, timingSafeEqual } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import { OrderStatus, ScanEvent } from '@prisma/client'
import { prisma } from '../../lib/prisma.js'
import { HttpError } from '../../lib/http-error.js'
import { domainEvents } from '../../lib/events.js'
import { applyCodWalletCreditOnDelivery } from '../../lib/seller-wallet.service.js'
import type { requestOtpBody, verifyOtpBody } from './otp.schema.js'
import type { z } from 'zod'

function pepper() {
  return process.env.OTP_PEPPER ?? 'dev-pepper-change-me'
}

function hashOtp(code: string, phone: string) {
  return createHash('sha256')
    .update(`${pepper()}:${phone}:${code}`)
    .digest('hex')
}

function safeEq(a: string, b: string) {
  try {
    const ba = Buffer.from(a, 'hex')
    const bb = Buffer.from(b, 'hex')
    if (ba.length !== bb.length) return false
    return timingSafeEqual(ba, bb)
  } catch {
    return false
  }
}

export async function requestOtp(input: z.infer<typeof requestOtpBody>) {
  const code = String(randomInt(100000, 999999))
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000)

  await prisma.oTPVerification.create({
    data: {
      phone: input.phone,
      codeHash: hashOtp(code, input.phone),
      purpose: input.purpose,
      expiresAt,
      orderId: input.orderId,
    },
  })

  if (process.env.NODE_ENV === 'production') {
    return { sent: true as const }
  }
  return { sent: true as const, _devCode: code }
}

export async function verifyOtp(input: z.infer<typeof verifyOtpBody>) {
  const row = await prisma.oTPVerification.findFirst({
    where: {
      phone: input.phone,
      purpose: input.purpose,
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  })

  if (!row) {
    throw new HttpError(400, 'No active OTP challenge')
  }

  if (!safeEq(row.codeHash, hashOtp(input.code, input.phone))) {
    throw new HttpError(400, 'Invalid code')
  }

  await prisma.oTPVerification.update({
    where: { id: row.id },
    data: { consumedAt: new Date() },
  })

  if (
    input.purpose === 'DELIVERY_COMPLETION' &&
    input.orderId &&
    input.workerId &&
    input.qrCode
  ) {
    const order = await prisma.order.findUnique({
      where: { id: input.orderId },
    })
    if (!order) throw new HttpError(404, 'Order not found')
    if (order.qrCode !== input.qrCode) {
      throw new HttpError(400, 'qrCode does not match order')
    }
    if (order.status !== OrderStatus.OUT_FOR_DELIVERY) {
      throw new HttpError(400, 'Order must be OUT_FOR_DELIVERY')
    }

    const lat = input.latitude ?? 0
    const lng = input.longitude ?? 0
    const photo = input.photoUrl ?? 'https://example.com/otp-proof-placeholder'

    const qrCode = input.qrCode!
    const workerId = input.workerId!

    const updated = await prisma.$transaction(async (tx) => {
      await tx.scanLog.create({
        data: {
          orderId: order.id,
          event: ScanEvent.OTP_VERIFY,
          qrCode,
          workerId,
          photoUrl: photo,
          latitude: lat,
          longitude: lng,
          scannedAt: new Date(),
          metadata: { via: 'OTP' } as Prisma.InputJsonValue,
        },
      })

      return tx.order.update({
        where: { id: order.id },
        data: { status: OrderStatus.DELIVERED },
      })
    })

    domainEvents.emit('order:status:changed', {
      orderId: updated.id,
      publicId: updated.publicId,
      from: OrderStatus.OUT_FOR_DELIVERY,
      to: OrderStatus.DELIVERED,
    })

    domainEvents.emit('order:tracking:updated', {
      orderId: updated.id,
      publicId: updated.publicId,
      kind: 'otp',
      eventKey: 'DELIVERY_COMPLETION',
    })

    void applyCodWalletCreditOnDelivery(updated.id).catch(console.error)

    return { verified: true as const, order: updated }
  }

  return { verified: true as const }
}
