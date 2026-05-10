import type { RequestHandler } from 'express'
import * as trackingService from './tracking.service.js'

/** No auth — rate-limit at edge in production. */
export const publicTimelineByRef: RequestHandler = async (req, res, next) => {
  try {
    const data = await trackingService.timelineByTrackingRef(
      req.params.trackingRef!
    )
    res.json({ ok: true, data })
  } catch (e) {
    next(e)
  }
}

export const timeline: RequestHandler = async (req, res, next) => {
  try {
    const data = await trackingService.timelineByPublicId(req.params.publicId!)
    res.json({ ok: true, data })
  } catch (e) {
    next(e)
  }
}
