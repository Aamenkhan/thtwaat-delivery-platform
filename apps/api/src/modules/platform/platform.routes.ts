import { Router } from 'express'
import { requireAuth, requireRole } from '../../middleware/auth.js'
import { validateBody } from '../../middleware/validate.js'
import { Role } from '@prisma/client'
import { createApiKeyBody, createWebhookSubBody } from './platform.schema.js'
import * as ctrl from './platform.controller.js'

const r = Router()

r.use(requireAuth, requireRole(Role.SELLER, Role.HUB_MANAGER))

r.post('/api-keys', validateBody(createApiKeyBody), ctrl.createApiKey)
r.get('/api-keys', ctrl.listApiKeys)
r.post('/api-keys/:id/revoke', ctrl.revokeApiKey)

r.post('/webhooks', validateBody(createWebhookSubBody), ctrl.createWebhook)
r.get('/webhooks', ctrl.listWebhooks)

export const platformRouter = r
