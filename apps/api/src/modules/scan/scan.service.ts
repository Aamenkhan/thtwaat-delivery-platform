import type { Prisma } from '@prisma/client'
import { OrderStatus, ScanEvent } from '@prisma/client'
import { prisma } from '../../lib/prisma.js'
import { HttpError } from '../../lib/http-error.js'
import {
  assertScanAllowed,
  nextStatusAfterScan,
} from '../../core/status-machine.js'
import { domainEvents } from '../../lib/events.js'
import { applyCodWalletCreditOnDelivery } from '../../lib/seller-wallet.service.js'
import type { createScanBody } from './scan.schema.js'
import type { z } from 'zod'

const DEFAULT_SCAN_PHOTO =
  process.env.SCAN_DEFAULT_PHOTO_URL ??
  'https://via.placeholder.com/800x600.png?text=Scan+proof'

export async function recordScan(input: z.infer<typeof createScanBody>) {
  const order = await prisma.order.findUnique({
    where: { qrCode: input.qrCode },
  })
  if (!order) {
    throw new HttpError(404, 'No order matches qrCode')
  }

  assertScanAllowed(order.status, input.event)

  const worker = await prisma.worker.findUnique({
    where: { id: input.workerId },
  })
  if (!worker?.isActive) {
    throw new HttpError(400, 'Invalid or inactive worker')
  }

  const next = nextStatusAfterScan(order.status, input.event)

  const updated = await prisma.$transaction(async (tx) => {
    await tx.scanLog.create({
      data: {
        orderId: order.id,
        event: input.event,
        qrCode: input.qrCode,
        workerId: input.workerId,
        photoUrl: input.photoUrl ?? DEFAULT_SCAN_PHOTO,
        latitude: input.latitude,
        longitude: input.longitude,
        scannedAt: input.timestamp,
        hubId: input.hubId,
        metadata: input.metadata as Prisma.InputJsonValue | undefined,
      },
    })

    await tx.trackingEvent.create({
      data: {
        orderId: order.id,
        source: 'scan',
        eventKey: input.event,
        payload: {
          workerId: input.workerId,
          hubId: input.hubId ?? null,
          lat: input.latitude,
          lng: input.longitude,
        },
      },
    })

    let currentHubId = order.currentHubId
    if (
      input.hubId &&
      (input.event === ScanEvent.HUB_DROP_SCAN ||
        input.event === ScanEvent.HUB_ACCEPT ||
        input.event === ScanEvent.RETURN_HUB_ACCEPT)
    ) {
      currentHubId = input.hubId
    }

    if (!next) {
      if (
        input.event === ScanEvent.SELLER_CONFIRM ||
        input.event === ScanEvent.OTP_VERIFY
      ) {
        return tx.order.findUniqueOrThrow({ where: { id: order.id } })
      }
    }

    const returnInitiated =
      input.event === ScanEvent.RETURN_INIT ? true : undefined

    const o = await tx.order.update({
      where: { id: order.id },
      data: {
        status: next ?? order.status,
        currentHubId,
        returnInitiated:
          returnInitiated === undefined ? undefined : returnInitiated,
      },
    })

    if (
      input.event === ScanEvent.DELIVERED &&
      next === OrderStatus.DELIVERED
    ) {
      await tx.workerEarning.create({
        data: {
          workerId: input.workerId,
          orderId: order.id,
          amountCents: 3000,
          kind: 'DELIVERY',
          note: 'MVP split: ₹30 delivery (stored as paise in amountCents)',
        },
      })
    }

    if (input.event === ScanEvent.PICKUP_SCAN) {
      await tx.workerEarning.create({
        data: {
          workerId: input.workerId,
          orderId: order.id,
          amountCents: 3000,
          kind: 'PICKUP',
          note: 'MVP split: ₹30 pickup (stored as paise in amountCents)',
        },
      })
    }

    return o
  })

  if (next && updated.status !== order.status) {
    domainEvents.emit('order:status:changed', {
      orderId: updated.id,
      publicId: updated.publicId,
      from: order.status,
      to: updated.status,
    })
    if (updated.status === OrderStatus.DELIVERED) {
      void applyCodWalletCreditOnDelivery(updated.id).catch(console.error)
    }
  }

  domainEvents.emit('order:tracking:updated', {
    orderId: updated.id,
    publicId: updated.publicId,
    kind: 'scan',
    eventKey: input.event,
  })

  return updated
}

export async function addPhotoProof(publicId: string, urls: string[]) {
  const order = await prisma.order.findUnique({ where: { publicId } })
  if (!order) throw new HttpError(404, 'Order not found')

  await prisma.$transaction(async (tx) => {
    for (const url of urls) {
      await tx.orderPhoto.create({
        data: { orderId: order.id, url, kind: 'PROOF_OF_DELIVERY' },
      })
    }
    await tx.trackingEvent.create({
      data: {
        orderId: order.id,
        source: 'photos',
        eventKey: 'proof.uploaded',
        payload: { count: urls.length },
      },
    })
  })

  domainEvents.emit('order:tracking:updated', {
    orderId: order.id,
    publicId: order.publicId,
    kind: 'proof',
    eventKey: 'proof.uploaded',
  })

  return prisma.order.findUnique({
    where: { publicId },
    include: { photos: true },
  })
}
