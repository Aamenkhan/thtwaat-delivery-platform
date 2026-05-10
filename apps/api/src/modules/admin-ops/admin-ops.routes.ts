import { Router } from 'express'
import { requireAuth } from '../../middleware/auth.js'
import { requirePlatformAdmin } from '../../middleware/platform-admin.js'
import * as commercial from '../commercial/commercial.service.js'

const r = Router()

r.use(requireAuth, requirePlatformAdmin)

r.get('/summary', async (_req, res, next) => {
  try {
    const summary = await commercial.adminOpsSummary()
    res.json({ ok: true, data: { summary } })
  } catch (e) {
    next(e)
  }
})

r.post('/settlement/workers', async (_req, res, next) => {
  try {
    const result = await commercial.runWorkerSettlement()
    res.json({ ok: true, data: result })
  } catch (e) {
    next(e)
  }
})

export const adminOpsRouter = r
