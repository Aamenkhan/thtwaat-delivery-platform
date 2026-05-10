import type { RequestHandler } from 'express'
import * as orderService from './order.service.js'
import * as scanService from '../scan/scan.service.js'
import { HttpError } from '../../lib/http-error.js'

export const create: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'Unauthorized')
    const order = await orderService.createOrder(req.body, req.auth)
    res.status(201).json({ ok: true, data: { order } })
  } catch (e) {
    next(e)
  }
}

export const getOne: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'Unauthorized')
    const order = await orderService.getByPublicId(req.params.publicId!)
    await orderService.assertOrderAccess(order, req.auth)
    res.json({ ok: true, data: { order } })
  } catch (e) {
    next(e)
  }
}

export const assignSourceHub: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'Unauthorized')
    const existing = await orderService.getByPublicId(req.params.publicId!)
    await orderService.assertAssignSourceHubAllowed(existing, req.auth)
    const order = await orderService.assignSourceHub(
      req.params.publicId!,
      req.body
    )
    res.json({ ok: true, data: { order } })
  } catch (e) {
    next(e)
  }
}

export const returnFlow: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'Unauthorized')
    const existing = await orderService.getByPublicId(req.params.publicId!)
    await orderService.assertOrderReturnEligible(existing, req.auth)
    const order = await orderService.requestReturn(
      req.params.publicId!,
      req.body
    )
    res.json({ ok: true, data: { order } })
  } catch (e) {
    next(e)
  }
}

export const patchStatus: RequestHandler = async (req, res, next) => {
  try {
    const order = await orderService.adminSetStatus(
      req.params.publicId!,
      req.body.status
    )
    res.json({ ok: true, data: { order } })
  } catch (e) {
    next(e)
  }
}

export const addPhotos: RequestHandler = async (req, res, next) => {
  try {
    const order = await scanService.addPhotoProof(
      req.params.publicId!,
      req.body.urls
    )
    res.json({ ok: true, data: { order } })
  } catch (e) {
    next(e)
  }
}
