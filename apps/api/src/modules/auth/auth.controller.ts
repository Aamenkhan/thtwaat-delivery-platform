import type { RequestHandler, Response } from 'express'
import { HttpError } from '../../lib/http-error.js'
import * as authService from './auth.service.js'

function setAuthCookies(res: Response, access: string, refresh: string) {
  const isProd = process.env.NODE_ENV === 'production'
  const maxAgeAccess = 1000 * 60 * 60 * 24 // 1 day
  const maxAgeRefresh = 1000 * 60 * 60 * 24 * 30 // 30 days
  
  res.cookie('thtwaat_access_token', access, {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    maxAge: maxAgeAccess
  })
  res.cookie('thtwaat_refresh_token', refresh, {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    maxAge: maxAgeRefresh
  })
}

function requestMeta(req: Parameters<RequestHandler>[0]) {
  return {
    userAgent: req.get('user-agent') ?? undefined,
    ip: req.ip,
  }
}

export const register: RequestHandler = async (req, res, next) => {
  try {
    const result = await authService.register(req.body, requestMeta(req))
    setAuthCookies(res, result.accessToken, result.refreshToken)
    res.status(201).json({ ok: true, data: result })
  } catch (e) {
    next(e)
  }
}

export const login: RequestHandler = async (req, res, next) => {
  try {
    const result = await authService.login(req.body, requestMeta(req))
    setAuthCookies(res, result.accessToken, result.refreshToken)
    res.json({ ok: true, data: result })
  } catch (e) {
    next(e)
  }
}

export const refresh: RequestHandler = async (req, res, next) => {
  try {
    const rToken = req.cookies.thtwaat_refresh_token || req.body.refreshToken
    if (!rToken) throw new HttpError(401, 'No refresh token provided')
    
    const result = await authService.refresh(rToken, requestMeta(req))
    setAuthCookies(res, result.accessToken, result.refreshToken)
    res.json({ ok: true, data: result })
  } catch (e) {
    next(e)
  }
}

export const logout: RequestHandler = async (req, res, next) => {
  try {
    const rToken = req.cookies.thtwaat_refresh_token || req.body.refreshToken
    if (rToken) {
      await authService.logout(rToken, { ip: req.ip })
    }
    res.clearCookie('thtwaat_access_token', { httpOnly: true, secure: true, sameSite: 'none' })
    res.clearCookie('thtwaat_refresh_token', { httpOnly: true, secure: true, sameSite: 'none' })
    res.json({ ok: true, data: { loggedOut: true } })
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
