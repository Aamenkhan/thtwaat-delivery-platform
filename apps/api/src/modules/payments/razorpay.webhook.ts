import { Router } from 'express'
import { verifyRazorpayWebhookSignature } from '../../lib/razorpay/razorpay-verify.js'
import { fulfillFromWebhookRazorpayOrder } from './razorpay.service.js'

export const razorpayWebhookRouter = Router()

razorpayWebhookRouter.post('/', async (req, res, next) => {
  try {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim()
    if (!secret) {
      res.status(503).json({ ok: false, error: 'RAZORPAY_WEBHOOK_SECRET not set' })
      return
    }
    const raw = req.body as Buffer
    if (!Buffer.isBuffer(raw) || raw.length === 0) {
      res.status(400).json({ ok: false, error: 'empty body' })
      return
    }
    const sig = req.get('x-razorpay-signature')
    if (!verifyRazorpayWebhookSignature(raw, sig, secret)) {
      res.status(400).json({ ok: false, error: 'invalid signature' })
      return
    }

    const json = JSON.parse(raw.toString('utf8')) as {
      event?: string
      payload?: {
        payment?: {
          entity?: { id?: string; order_id?: string; status?: string }
        }
      }
    }

    if (json.event === 'payment.captured') {
      const ent = json.payload?.payment?.entity
      const orderId = ent?.order_id
      const payId = ent?.id
      const status = ent?.status
      if (orderId && payId && status === 'captured') {
        await fulfillFromWebhookRazorpayOrder(orderId, payId)
      }
    }

    res.json({ ok: true })
  } catch (e) {
    next(e)
  }
})
