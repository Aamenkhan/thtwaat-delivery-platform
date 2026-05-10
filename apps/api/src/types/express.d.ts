import type { MembershipRole, Role } from '@prisma/client'

declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: string
        role: Role
        orgId?: string
        membershipRole?: MembershipRole
      }
      apiKeyAuth?: {
        id: string
        sellerId: string
        organizationId?: string | null
        rateLimitPerMinute: number
        scopes: string[]
      }
      rawBody?: Buffer
    }
  }
}

export {}
