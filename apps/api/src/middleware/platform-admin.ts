import type { RequestHandler } from 'express'
import { Role } from '@prisma/client'
import { requireRole } from './auth.js'

/** Platform operators (legacy `ADMIN` + `SUPER_ADMIN`). */
export const requirePlatformAdmin: RequestHandler = requireRole(
  Role.SUPER_ADMIN,
  Role.ADMIN
)
