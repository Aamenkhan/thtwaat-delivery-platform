import { OrderStatus, PayoutStatus } from '@prisma/client'
import { prisma } from './prisma.js'
import { HttpError } from './http-error.js'
import { dispatchPlatformWebhook } from './webhooks/platform-dispatch.js'
import { enqueueWhatsAppNotify } from './whatsapp/whatsapp-notify.service.js'

const COD_CREDIT = 'COD_CREDIT'
const PAYOUT_DEBIT = 'PAYOUT_DEBIT'

function formatCodInr(paise: number): string {
  const rupees = paise / 100
  return `₹${rupees.toLocaleString('en-IN', {
    minimumFractionDigits: rupees % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`
}

type CodCreditTxResult =
  | { credited: false }
  | {
      credited: true
      publicId: string
      sellerId: string
      orderDbId: string
      status: OrderStatus
      codPaise: number
    }

/**
 * On COD delivery, credit seller wallet once (idempotent per order).
 */
export async function applyCodWalletCreditOnDelivery(orderId: string) {
  const result = await prisma.$transaction(async (tx): Promise<CodCreditTxResult> => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { seller: { include: { wallet: true } } },
    })
    if (!order?.seller.wallet) return { credited: false }
    const cod = order.codAmountCents ?? 0
    if (cod <= 0) return { credited: false }

    const existing = await tx.walletLedgerEntry.findFirst({
      where: { orderId, type: COD_CREDIT },
    })
    if (existing) return { credited: false }

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

    return {
      credited: true,
      publicId: order.publicId,
      sellerId: order.sellerId,
      orderDbId: order.id,
      status: order.status,
      codPaise: cod,
    }
  })

  if (!result.credited) return

  await dispatchPlatformWebhook({
    event: 'wallet.credited',
    orderId: result.orderDbId,
    publicId: result.publicId,
    sellerId: result.sellerId,
    status: result.status,
    payload: { reason: 'cod_delivered' },
  })

  void enqueueWhatsAppNotify({
    templateKey: 'cod_collected',
    orderPublicId: result.publicId,
    extras: { codDisplay: formatCodInr(result.codPaise) },
  }).catch(console.error)
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
