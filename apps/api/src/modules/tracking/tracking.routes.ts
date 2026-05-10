import { Router } from 'express'
import { requireAuth } from '../../middleware/auth.js'
import * as ctrl from './tracking.controller.js'

const r = Router()

r.get('/public/:trackingRef/timeline', ctrl.publicTimelineByRef)
r.get('/:publicId/timeline', requireAuth, ctrl.timeline)

export const trackingRouter = r
