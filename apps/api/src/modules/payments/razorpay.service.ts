import { randomUUID } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import {
  RazorpayPaymentPurpose,
  RazorpayPaymentStatus,
} from '@prisma/client'
import { prisma } from '../../lib/prisma.js'
import { HttpError } from '../../lib/http-error.js'
import { razorpayCreateOrderApi } from '../../lib/razorpay/razorpay-http.js'
import { verifyRazorpayPaymentSignature } from '../../lib/razorpay/razorpay-verify.js'
import {
  planAmountPaise,
  RAZORPAY_PLANS,
  type RazorpayPlanCode,
} from './razorpay-plans.js'
import type { CreateRazorpayOrderInput, VerifyRazorpayPaymentInput } from './razorpay.schema.js'

export function listRazorpayPlans() {
  return Object.entries(RAZORPAY_PLANS).map(([code, v]) => ({
    code: code as RazorpayPlanCode,
    label: v.label,
    amountPaise: v.amountPaise,
    periodDays: v.periodDays,
  }))
}

export async function getActiveSubscription(sellerId: string) {
  return prisma.sellerSubscription.findFirst({
    where: { sellerId, status: 'ACTIVE' },
    orderBy: { currentPeriodEnd: 'desc' },
  })
}

async function latestQuotedPaise(orderId: string): Promise<number | null> {
  const ev = await prisma.trackingEvent.findFirst({
    where: { orderId, eventKey: 'pricing.quoted', source: 'pricing' },
    orderBy: { createdAt: 'desc' },
  })
  const payload = ev?.payload as { amountCents?: number } | null
  return typeof payload?.amountCents === 'number' ? payload.amountCents : null
}

function resolveAmountPaise(
  input: CreateRazorpayOrderInput,
  quoted: number | null
): number {
  if (input.purpose === 'SUBSCRIPTION' && input.planCode) {
    return planAmountPaise(input.planCode)
  }
  if (input.purpose === 'SHIPMENT_FEE') {
    if (input.amountPaise != null) {
      if (quoted != null && Math.abs(input.amountPaise - quoted) > 50) {
        throw new HttpError(
          400,
          `amountPaise must match quoted fare (${quoted} paise) within tolerance`
        )
      }
      return input.amountPaise
    }
    if (quoted == null) {
      throw new HttpError(
        400,
        'No quoted pricing on this shipment yet; pass amountPaise or wait for pricing.quoted event'
      )
    }
    return quoted
  }
  if (input.amountPaise == null) {
    throw new HttpError(400, 'amountPaise required')
  }
  if (input.purpose === 'COD_SETTLEMENT') {
    if (input.amountPaise < 100) {
      throw new HttpError(400, 'Minimum COD settlement is ₹1 (100 paise)')
    }
  }
  return input.amountPaise
}

export async function createSellerRazorpayOrder(
  sellerId: string,
  input: CreateRazorpayOrderInput
) {
  let orderId: string | null = null
  let quoted: number | null = null

  if (input.purpose === 'SHIPMENT_FEE') {
    const order = await prisma.order.findFirst({
      where: { publicId: input.orderPublicId!, sellerId },
      select: { id: true, shippingPaidAt: true },
    })
    if (!order) throw new HttpError(404, 'Order not found')
    if (order.shippingPaidAt) {
      throw new HttpError(400, 'Shipment fee already paid for this order')
    }
    const existingPaid = await prisma.razorpayPayment.findFirst({
      where: {
        sellerId,
        orderId: order.id,
        purpose: RazorpayPaymentPurpose.SHIPMENT_FEE,
        status: RazorpayPaymentStatus.PAID,
      },
    })
    if (existingPaid) {
      throw new HttpError(400, 'Shipment fee already recorded')
    }
    orderId = order.id
    quoted = await latestQuotedPaise(order.id)
  }

  if (input.purpose === 'COD_SETTLEMENT') {
    const wallet = await prisma.wallet.findUnique({ where: { sellerId } })
    if (!wallet) throw new HttpError(400, 'Wallet not found')
    const amt = input.amountPaise!
    if (wallet.balanceCents < amt) {
      throw new HttpError(
        400,
        'Insufficient wallet balance for this COD settlement amount'
      )
    }
  }

  const amountPaise = resolveAmountPaise(input, quoted)

  const tempOrderKey = `temp_${randomUUID().replace(/-/g, '')}`
  const internal = await prisma.razorpayPayment.create({
    data: {
      sellerId,
      purpose: input.purpose as RazorpayPaymentPurpose,
      amountPaise,
      status: RazorpayPaymentStatus.CREATED,
      razorpayOrderId: tempOrderKey,
      receipt: `rcp_${tempOrderKey.slice(0, 36)}`,
      orderId,
      planCode: input.planCode ?? null,
    },
  })

  const receipt = `rcp_${internal.id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 32)}`

  try {
    const rz = await razorpayCreateOrderApi({
      amountPaise,
      receipt,
      notes: {
        internalPaymentId: internal.id,
        sellerId,
        purpose: input.purpose,
      },
    })

    const updated = await prisma.razorpayPayment.update({
      where: { id: internal.id },
      data: {
        razorpayOrderId: rz.id,
        receipt,
      },
    })

    return {
      payment: updated,
      razorpayOrderId: rz.id,
      amountPaise,
      currency: rz.currency ?? 'INR',
    }
  } catch (e) {
    await prisma.razorpayPayment.delete({ where: { id: internal.id } }).catch(() => {})
    throw e
  }
}

export async function verifyAndFulfillSellerPayment(
  sellerId: string,
  input: VerifyRazorpayPaymentInput
) {
  const secret = process.env.RAZORPAY_KEY_SECRET
  if (!secret) throw new HttpError(503, 'Razorpay not configured')

  if (
    !verifyRazorpayPaymentSignature(
      input.razorpay_order_id,
      input.razorpay_payment_id,
      input.razorpay_signature,
      secret
    )
  ) {
    throw new HttpError(400, 'Invalid payment signature')
  }

  const row = await prisma.razorpayPayment.findFirst({
    where: { sellerId, razorpayOrderId: input.razorpay_order_id },
  })
  if (!row) throw new HttpError(404, 'Payment session not found')

  await fulfillRazorpayPayment({
    internalPaymentId: row.id,
    razorpayOrderId: input.razorpay_order_id,
    razorpayPaymentId: input.razorpay_payment_id,
  })

  return { ok: true as const, paymentId: row.id }
}

export async function fulfillRazorpayPayment(params: {
  internalPaymentId: string
  razorpayOrderId: string
  razorpayPaymentId: string
}) {
  await prisma.$transaction(async (tx) => {
    const row = await tx.razorpayPayment.findUnique({
      where: { id: params.internalPaymentId },
    })
    if (!row) return
    if (row.razorpayOrderId !== params.razorpayOrderId) {
      throw new HttpError(400, 'Order id mismatch')
    }
    if (row.status === RazorpayPaymentStatus.PAID) return

    const lock = await tx.razorpayPayment.updateMany({
      where: { id: row.id, status: RazorpayPaymentStatus.CREATED },
      data: {
        status: RazorpayPaymentStatus.PAID,
        paidAt: new Date(),
        razorpayPaymentId: params.razorpayPaymentId,
      },
    })
    if (lock.count === 0) return

    let wallet = await tx.wallet.findUnique({ where: { sellerId: row.sellerId } })
    if (!wallet) {
      wallet = await tx.wallet.create({
        data: { sellerId: row.sellerId, balanceCents: 0, currency: 'INR' },
      })
    }

    const metaBase = {
      razorpayOrderId: params.razorpayOrderId,
      razorpayPaymentId: params.razorpayPaymentId,
      internalPaymentId: row.id,
    } satisfies Record<string, string>

    switch (row.purpose) {
      case RazorpayPaymentPurpose.WALLET_RECHARGE: {
        const next = wallet.balanceCents + row.amountPaise
        await tx.wallet.update({
          where: { id: wallet.id },
          data: { balanceCents: next },
        })
        await tx.walletLedgerEntry.create({
          data: {
            sellerId: row.sellerId,
            type: 'RAZORPAY_TOPUP',
            amountCents: row.amountPaise,
            balanceAfterCents: next,
            currency: wallet.currency,
            metadata: metaBase as Prisma.InputJsonValue,
          },
        })
        break
      }
      case RazorpayPaymentPurpose.COD_SETTLEMENT: {
        if (wallet.balanceCents < row.amountPaise) {
          throw new HttpError(409, 'Wallet balance dropped below settlement amount')
        }
        const next = wallet.balanceCents - row.amountPaise
        await tx.wallet.update({
          where: { id: wallet.id },
          data: { balanceCents: next },
        })
        await tx.walletLedgerEntry.create({
          data: {
            sellerId: row.sellerId,
            type: 'COD_SETTLEMENT_DEBIT',
            amountCents: -row.amountPaise,
            balanceAfterCents: next,
            currency: wallet.currency,
            metadata: metaBase as Prisma.InputJsonValue,
          },
        })
        break
      }
      case RazorpayPaymentPurpose.SHIPMENT_FEE: {
        if (!row.orderId) break
        await tx.order.update({
          where: { id: row.orderId },
          data: { shippingPaidAt: new Date() },
        })
        await tx.walletLedgerEntry.create({
          data: {
            sellerId: row.sellerId,
            orderId: row.orderId,
            type: 'SHIPMENT_FEE_PAID',
            amountCents: 0,
            balanceAfterCents: wallet.balanceCents,
            currency: wallet.currency,
            metadata: {
              ...metaBase,
              paidPaise: row.amountPaise,
              note: 'Shipment fee settled via Razorpay (external)',
            } as Prisma.InputJsonValue,
          },
        })
        break
      }
      case RazorpayPaymentPurpose.SUBSCRIPTION: {
        const planCode = row.planCode as RazorpayPlanCode | null
        if (!planCode || !RAZORPAY_PLANS[planCode]) break
        const days = RAZORPAY_PLANS[planCode].periodDays
        const end = new Date()
        end.setUTCDate(end.getUTCDate() + days)

        await tx.sellerSubscription.updateMany({
          where: { sellerId: row.sellerId, status: 'ACTIVE' },
          data: { status: 'EXPIRED' },
        })

        const sub = await tx.sellerSubscription.create({
          data: {
            sellerId: row.sellerId,
            planCode,
            status: 'ACTIVE',
            currentPeriodEnd: end,
          },
        })

        await tx.razorpayPayment.update({
          where: { id: row.id },
          data: { subscriptionId: sub.id },
        })
        await tx.walletLedgerEntry.create({
          data: {
            sellerId: row.sellerId,
            type: 'SUBSCRIPTION_PAYMENT',
            amountCents: 0,
            balanceAfterCents: wallet.balanceCents,
            currency: wallet.currency,
            metadata: {
              ...metaBase,
              planCode,
              paidPaise: row.amountPaise,
              subscriptionId: sub.id,
            } as Prisma.InputJsonValue,
          },
        })
        break
      }
      default:
        break
    }
  })
}

/** Webhook: resolve internal id from order notes or DB row. */
export async function fulfillFromWebhookRazorpayOrder(
  razorpayOrderId: string,
  razorpayPaymentId: string
) {
  const row = await prisma.razorpayPayment.findUnique({
    where: { razorpayOrderId },
  })
  if (!row) {
    console.warn(`[razorpay] webhook: unknown order ${razorpayOrderId}`)
    return
  }
  await fulfillRazorpayPayment({
    internalPaymentId: row.id,
    razorpayOrderId,
    razorpayPaymentId,
  })
}
