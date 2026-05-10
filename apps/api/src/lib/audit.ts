import type { MembershipRole, Prisma, Role } from '@prisma/client'
import { prisma } from './prisma.js'

export async function writeAuditLog(input: {
  actorUserId?: string | null
  apiKeyId?: string | null
  action: string
  resource: string
  resourceId?: string | null
  metadata?: Record<string, unknown> | null
  ip?: string | null
}) {
  try {
    await prisma.auditLog.create({
      data: {
        actorUserId: input.actorUserId ?? undefined,
        apiKeyId: input.apiKeyId ?? undefined,
        action: input.action,
        resource: input.resource,
        resourceId: input.resourceId ?? undefined,
        metadata:
          input.metadata === null || input.metadata === undefined ?
            undefined
          : (input.metadata as Prisma.InputJsonValue),
        ip: input.ip ?? undefined,
      },
    })
  } catch (e) {
    console.error('[audit] write failed', e)
  }
}

export function redactAuthForAudit(p: {
  role: Role
  orgId?: string
  membershipRole?: MembershipRole
}) {
  return { role: p.role, orgId: p.orgId, membershipRole: p.membershipRole }
}
