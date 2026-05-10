import type { RequestHandler } from 'express'
import * as svc from './admin-logistics.service.js'

export const summary: RequestHandler = async (_req, res, next) => {
  try {
    const data = await svc.getLogisticsSummary()
    res.json({ ok: true, data })
  } catch (e) {
    next(e)
  }
}
