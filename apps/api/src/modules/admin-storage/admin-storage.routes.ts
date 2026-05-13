import { Router } from 'express'
import { z } from 'zod'
import { requireAuth } from '../../middleware/auth.js'
import { requirePlatformAdmin } from '../../middleware/platform-admin.js'
import { validateBody } from '../../middleware/validate.js'
import { HttpError } from '../../lib/http-error.js'
import { prisma } from '../../lib/prisma.js'
import {
  createHubImageSignedUpload,
} from '../../lib/supabase-storage.js'

const r = Router()

r.use(requireAuth, requirePlatformAdmin)

const signUploadBody = z.object({
  hubId: z.string().min(1),
  assetType: z.enum(['hub', 'bus', 'transport', 'truck']),
  filename: z.string().min(1).max(200),
  contentType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
})

r.post('/sign-upload', validateBody(signUploadBody), async (req, res, next) => {
  try {
    const hub = await prisma.hub.findUnique({
      where: { id: req.body.hubId },
      select: { id: true },
    })
    if (!hub) {
      next(new HttpError(404, 'Hub not found'))
      return
    }
    const signed = await createHubImageSignedUpload({
      hubId: req.body.hubId,
      assetType: req.body.assetType,
      filename: req.body.filename,
      contentType: req.body.contentType,
    })
    res.json({
      ok: true,
      data: {
        signedUrl: signed.signedUrl,
        token: signed.token,
        path: signed.path,
        publicUrl: signed.publicUrl,
      },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes('SUPABASE_URL') || msg.includes('SUPABASE_SERVICE_ROLE')) {
      next(new HttpError(503, 'Supabase Storage is not configured on the server'))
      return
    }
    next(e)
  }
})

export const adminStorageRouter = r
