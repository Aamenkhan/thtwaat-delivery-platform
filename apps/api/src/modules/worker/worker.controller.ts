import type { RequestHandler } from 'express'
import * as workerService from './worker.service.js'
import { HttpError } from '../../lib/http-error.js'

export const myProfile: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'Unauthorized')
    const worker = await workerService.workerProfileByUserId(req.auth.userId)
    res.json({ ok: true, data: { worker } })
  } catch (e) {
    next(e)
  }
}

export const myRoutes: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'Unauthorized')
    const orders = await workerService.listMyAssignedOrders(req.auth.userId)
    res.json({ ok: true, data: { orders } })
  } catch (e) {
    next(e)
  }
}

export const pingLocation: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'Unauthorized')
    await workerService.recordWorkerGpsPing(req.auth.userId, req.body)
    res.json({ ok: true, data: { recorded: true } })
  } catch (e) {
    next(e)
  }
}

export const list: RequestHandler = async (req, res, next) => {
  try {
    const role = typeof req.query.role === 'string' ? req.query.role : undefined
    const workers = await workerService.listWorkers(role)
    res.json({ ok: true, data: { workers } })
  } catch (e) {
    next(e)
  }
}

export const create: RequestHandler = async (req, res, next) => {
  try {
    const worker = await workerService.createWorker(req.body)
    res.status(201).json({ ok: true, data: { worker } })
  } catch (e) {
    next(e)
  }
}

export const earnings: RequestHandler = async (req, res, next) => {
  try {
    const rows = await workerService.earningsForWorker(req.params.workerId!)
    res.json({ ok: true, data: { earnings: rows } })
  } catch (e) {
    next(e)
  }
}

export const postEarning: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'Unauthorized')
    const row = await workerService.addEarning(
      req.params.workerId!,
      req.body,
      req.auth.role
    )
    res.status(201).json({ ok: true, data: { earning: row } })
  } catch (e) {
    next(e)
  }
}
