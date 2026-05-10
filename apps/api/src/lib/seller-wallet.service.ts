import { PayoutStatus } from '@prisma/client'
import { prisma } from './prisma.js'
import { HttpError } from './http-error.js'
import { dispatchPlatformWebhook } from './webhooks/platform-dispatch.js'

const COD_CREDIT = 'COD_CREDIT'
const PAYOUT_DEBIT = 'PAYOUT_DEBIT'

/**
 * On COD delivery, credit seller wallet once (idempotent per order).
 */
export async function applyCodWalletCreditOnDelivery(orderId: string) {
  await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { seller: { include: { wallet: true } } },
    })
    if (!order?.seller.wallet) return
    const cod = order.codAmountCents ?? 0
    if (cod <= 0) return

    const existing = await tx.walletLedgerEntry.findFirst({
      where: { orderId, type: COD_CREDIT },
    })
    if (existing) return

    const wallet = order.seller.wallet
    const nextBal = wallet.balanceCents + cod

    await tx.wallet.update({
      where: { id: wallet.id },
      data: { balanceCents: nextBal },
    })

    await tx.walletLedgerEntry.create({
      data: {
        sellerId: order.sellerId,
        orderId: order.id,
        type: COD_CREDIT,
        amountCents: cod,
        balanceAfterCents: nextBal,
        currency: wallet.currency,
        metadata: { publicId: order.publicId },
      },
    })
  })

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { sellerId: true, publicId: true, id: true, status: true },
  })
  if (order) {
    await dispatchPlatformWebhook({
      event: 'wallet.credited',
      orderId: order.id,
      publicId: order.publicId,
      sellerId: order.sellerId,
      status: order.status,
      payload: { reason: 'cod_delivered' },
    })
  }
}

export async function getWalletSnapshot(sellerId: string) {
  const wallet = await prisma.wallet.findUnique({ where: { sellerId } })
  if (!wallet) throw new HttpError(404, 'Wallet not found')
  return wallet
}

export async function listWalletLedger(sellerId: string, take: number) {
  return prisma.walletLedgerEntry.findMany({
    where: { sellerId },
    orderBy: { createdAt: 'desc' },
    take,
    include: { order: { select: { publicId: true, status: true } } },
  })
}

export async function listPayoutsForSeller(sellerId: string, take: number) {
  return prisma.payout.findMany({
    where: { sellerId },
    orderBy: { createdAt: 'desc' },
    take,
  })
}

export async function requestPayoutDebit(
  sellerId: string,
  amountCents: number
) {
  if (amountCents < 100) {
    throw new HttpError(400, 'Minimum payout is ₹1 (100 paise)')
  }

  return prisma.$transaction(async (tx) => {
    const wallet = await tx.wallet.findUnique({ where: { sellerId } })
    if (!wallet) throw new HttpError(404, 'Wallet not found')
    if (wallet.balanceCents < amountCents) {
      throw new HttpError(400, 'Insufficient wallet balance')
    }

    const nextBal = wallet.balanceCents - amountCents
    await tx.wallet.update({
      where: { id: wallet.id },
      data: { balanceCents: nextBal },
    })

    const payout = await tx.payout.create({
      data: {
        sellerId,
        amountCents,
        currency: wallet.currency,
        status: PayoutStatus.PENDING,
        reference: `payout_${Date.now()}`,
      },
    })

    await tx.walletLedgerEntry.create({
      data: {
        sellerId,
        type: PAYOUT_DEBIT,
        amountCents: -amountCents,
        balanceAfterCents: nextBal,
        currency: wallet.currency,
        metadata: { payoutId: payout.id },
      },
    })

    return payout
  })
}
