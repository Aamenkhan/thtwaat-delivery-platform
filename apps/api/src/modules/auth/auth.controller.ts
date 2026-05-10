import type { RequestHandler } from 'express'
import { HttpError } from '../../lib/http-error.js'
import * as authService from './auth.service.js'

function requestMeta(req: Parameters<RequestHandler>[0]) {
  return {
    userAgent: req.get('user-agent') ?? undefined,
    ip: req.ip,
  }
}

export const register: RequestHandler = async (req, res, next) => {
  try {
    const result = await authService.register(req.body, requestMeta(req))
    res.status(201).json({ ok: true, data: result })
  } catch (e) {
    next(e)
  }
}

export const login: RequestHandler = async (req, res, next) => {
  try {
    const result = await authService.login(req.body, requestMeta(req))
    res.json({ ok: true, data: result })
  } catch (e) {
    next(e)
  }
}

export const refresh: RequestHandler = async (req, res, next) => {
  try {
    const result = await authService.refresh(
      req.body.refreshToken,
      requestMeta(req)
    )
    res.json({ ok: true, data: result })
  } catch (e) {
    next(e)
  }
}

export const logout: RequestHandler = async (req, res, next) => {
  try {
    const result = await authService.logout(req.body.refreshToken, {
      ip: req.ip,
    })
    res.json({ ok: true, data: result })
  } catch (e) {
    next(e)
  }
}

export const switchOrg: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'Unauthorized')
    const result = await authService.switchOrganization(
      req.auth.userId,
      req.body.organizationId,
      requestMeta(req)
    )
    res.json({ ok: true, data: result })
  } catch (e) {
    next(e)
  }
}
