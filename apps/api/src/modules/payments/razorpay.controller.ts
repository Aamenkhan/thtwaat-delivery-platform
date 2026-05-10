import type { RequestHandler } from 'express'
import { RazorpayPaymentPurpose } from '@prisma/client'
import { requireSellerFromRequest } from '../../lib/seller-context.js'
import { getRazorpayPublishableKeyId } from '../../lib/razorpay/razorpay-http.js'
import * as svc from './razorpay.service.js'

function purposeLabel(p: RazorpayPaymentPurpose): string {
  switch (p) {
    case RazorpayPaymentPurpose.WALLET_RECHARGE:
      return 'Wallet recharge'
    case RazorpayPaymentPurpose.COD_SETTLEMENT:
      return 'COD settlement'
    case RazorpayPaymentPurpose.SUBSCRIPTION:
      return 'Subscription'
    case RazorpayPaymentPurpose.SHIPMENT_FEE:
      return 'Shipment payment'
    default:
      return 'Payment'
  }
}

export const createOrder: RequestHandler = async (req, res, next) => {
  try {
    const seller = await requireSellerFromRequest(req)
    const out = await svc.createSellerRazorpayOrder(seller.id, req.body)
    res.status(201).json({
      ok: true,
      data: {
        internalPaymentId: out.payment.id,
        razorpayOrderId: out.razorpayOrderId,
        amountPaise: out.amountPaise,
        currency: out.currency,
        keyId: getRazorpayPublishableKeyId(),
        description: purposeLabel(out.payment.purpose),
      },
    })
  } catch (e) {
    next(e)
  }
}

export const verify: RequestHandler = async (req, res, next) => {
  try {
    const seller = await requireSellerFromRequest(req)
    const data = await svc.verifyAndFulfillSellerPayment(seller.id, req.body)
    res.json({ ok: true, data })
  } catch (e) {
    next(e)
  }
}

export const publicConfig: RequestHandler = (_req, res) => {
  res.json({
    ok: true,
    data: {
      keyId: getRazorpayPublishableKeyId(),
      testMode: Boolean(process.env.RAZORPAY_KEY_ID?.startsWith('rzp_test_')),
    },
  })
}

export const plans: RequestHandler = async (_req, res) => {
  res.json({ ok: true, data: { plans: svc.listRazorpayPlans() } })
}

export const subscription: RequestHandler = async (req, res, next) => {
  try {
    const seller = await requireSellerFromRequest(req)
    const sub = await svc.getActiveSubscription(seller.id)
    res.json({
      ok: true,
      data: {
        subscription: sub
          ? {
              id: sub.id,
              planCode: sub.planCode,
              status: sub.status,
              currentPeriodEnd: sub.currentPeriodEnd,
            }
          : null,
      },
    })
  } catch (e) {
    next(e)
  }
}
