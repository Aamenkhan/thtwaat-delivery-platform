import { Router } from 'express'
import { validateBody } from '../../middleware/validate.js'
import { requestOtpBody, verifyOtpBody } from './otp.schema.js'
import * as ctrl from './otp.controller.js'

const r = Router()

r.post('/request', validateBody(requestOtpBody), ctrl.request)
r.post('/verify', validateBody(verifyOtpBody), ctrl.verify)

export const otpRouter = r
