import type { RequestHandler } from 'express'
import * as hubService from './hub.service.js'

export const create: RequestHandler = async (req, res, next) => {
  try {
    const hub = await hubService.createHub(req.body)
    res.status(201).json({ ok: true, data: { hub } })
  } catch (e) {
    next(e)
  }
}

export const list: RequestHandler = async (_req, res, next) => {
  try {
    const hubs = await hubService.listHubs()
    res.json({ ok: true, data: { hubs } })
  } catch (e) {
    next(e)
  }
}

export const patchZone: RequestHandler = async (req, res, next) => {
  try {
    const hub = await hubService.updateZone(req.params.hubId!, req.body)
    res.json({ ok: true, data: { hub } })
  } catch (e) {
    next(e)
  }
}

export const nearest: RequestHandler = async (req, res, next) => {
  try {
    const data = await hubService.nearestHub(req.body)
    res.json({ ok: true, data })
  } catch (e) {
    next(e)
  }
}

export const assignRoute: RequestHandler = async (req, res, next) => {
  try {
    const data = await hubService.assignRoute(req.body)
    res.json({ ok: true, data })
  } catch (e) {
    next(e)
  }
}
