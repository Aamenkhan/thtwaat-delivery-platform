import type { MembershipRole, Role, WorkerRole } from '@prisma/client'

declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: string
        role: Role
        orgId?: string
        membershipRole?: MembershipRole
      }
      workerAuth?: {
        workerId: string
        hubId: string | null
        workerRole: WorkerRole
        role: Role
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
