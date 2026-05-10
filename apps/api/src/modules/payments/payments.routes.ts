import { Router } from 'express'
import { Role } from '@prisma/client'
import { requireAuth, requireRole } from '../../middleware/auth.js'
import { validateBody } from '../../middleware/validate.js'
import { createRazorpayOrderBody, verifyRazorpayPaymentBody } from './razorpay.schema.js'
import * as razorpayCtrl from './razorpay.controller.js'

const r = Router()

r.use(requireAuth, requireRole(Role.SELLER, Role.HUB_MANAGER))

r.get('/razorpay/config', razorpayCtrl.publicConfig)
r.get('/subscription/plans', razorpayCtrl.plans)
r.get('/subscription', razorpayCtrl.subscription)

r.post(
  '/razorpay/order',
  validateBody(createRazorpayOrderBody),
  razorpayCtrl.createOrder
)
r.post(
  '/razorpay/verify',
  validateBody(verifyRazorpayPaymentBody),
  razorpayCtrl.verify
)

export const paymentsSellerRouter = r
