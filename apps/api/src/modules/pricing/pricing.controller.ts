import type { RequestHandler } from 'express'
import * as pricingService from './pricing.service.js'

export const quote: RequestHandler = async (req, res, next) => {
  try {
    const data = await pricingService.quote(req.body)
    res.json({ ok: true, data })
  } catch (e) {
    next(e)
  }
}
