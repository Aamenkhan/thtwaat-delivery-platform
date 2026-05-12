import { z } from 'zod'
import { Role } from '@prisma/client'

export const registerBody = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  phone: z.string().optional(),
  role: z.nativeEnum(Role).default(Role.CUSTOMER),
  companyName: z.string().optional(),
  fullName: z.string().optional(),
})

export const loginBody = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export const refreshBody = z.object({
  refreshToken: z.string().min(20),
})

export const switchOrgBody = z.object({
  organizationId: z.string().min(1),
})

export const googleLoginBody = z.object({
  idToken: z.string().min(20),
})

export const logoutBody = z.object({
  refreshToken: z.string().min(20).optional(),
})
