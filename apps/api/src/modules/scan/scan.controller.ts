import type { RequestHandler } from 'express'
import * as scanService from './scan.service.js'

export const createScan: RequestHandler = async (req, res, next) => {
  try {
    const order = await scanService.recordScan(req.body)
    res.status(201).json({ ok: true, data: { order } })
  } catch (e) {
    next(e)
  }
}
