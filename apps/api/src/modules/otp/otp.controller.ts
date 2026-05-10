import type { RequestHandler } from 'express'
import * as otpService from './otp.service.js'

export const request: RequestHandler = async (req, res, next) => {
  try {
    const data = await otpService.requestOtp(req.body)
    res.json({ ok: true, data })
  } catch (e) {
    next(e)
  }
}

export const verify: RequestHandler = async (req, res, next) => {
  try {
    const data = await otpService.verifyOtp(req.body)
    res.json({ ok: true, data })
  } catch (e) {
    next(e)
  }
}
