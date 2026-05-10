import { createHash, randomBytes } from 'node:crypto'
import bcrypt from 'bcryptjs'
import {
  MembershipRole,
  Prisma,
  Role,
} from '@prisma/client'
import { prisma } from '../../lib/prisma.js'
import { signAccessToken } from '../../lib/jwt.js'
import { HttpError } from '../../lib/http-error.js'
import { writeAuditLog } from '../../lib/audit.js'
import type { loginBody, registerBody } from './auth.schema.js'
import type { z } from 'zod'

const REFRESH_BYTES = 48
const REFRESH_DAYS = 30

function hashRefresh(raw: string) {
  return createHash('sha256').update(raw).digest('hex')
}

async function uniqueOrgSlug(base: string): Promise<string> {
  const slugBase =
    base
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'workspace'
  for (let i = 0; i < 20; i++) {
    const suffix = i === 0 ? '' : `-${randomBytes(2).toString('hex')}`
    const slug = `${slugBase}${suffix}`.slice(0, 64)
    const hit = await prisma.organization.findUnique({ where: { slug } })
    if (!hit) return slug
  }
  return `ws-${randomBytes(8).toString('hex')}`
}

async function bootstrapOrganizationForSeller(
  tx: Prisma.TransactionClient,
  sellerId: string,
  userId: string,
  nameHint: string
) {
  const slug = await uniqueOrgSlug(nameHint)
  const org = await tx.organization.create({
    data: { name: nameHint.slice(0, 120) || 'Workspace', slug },
  })
  await tx.organizationMember.create({
    data: {
      organizationId: org.id,
      userId,
      role: MembershipRole.SELLER,
    },
  })
  await tx.seller.update({
    where: { id: sellerId },
    data: { organizationId: org.id },
  })
  return org.id
}

async function resolveOrgContextForUser(userId: string) {
  const members = await prisma.organizationMember.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' },
    take: 1,
  })
  const first = members[0]
  if (!first) return { orgId: undefined as string | undefined, membershipRole: undefined as MembershipRole | undefined }
  return { orgId: first.organizationId, membershipRole: first.role }
}

async function ensureSellerWorkspace(userId: string) {
  const seller = await prisma.seller.findUnique({ where: { userId } })
  if (!seller) return
  if (seller.organizationId) return
  await prisma.$transaction(async (tx) => {
    await bootstrapOrganizationForSeller(
      tx,
      seller.id,
      userId,
      seller.companyName ?? 'Workspace'
    )
  })
}

async function createRefreshTokenRow(
  userId: string,
  raw: string,
  meta: { userAgent?: string; ip?: string }
) {
  return prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: hashRefresh(raw),
      expiresAt: new Date(Date.now() + REFRESH_DAYS * 864e5 * 1000),
      userAgent: meta.userAgent,
      ip: meta.ip,
    },
  })
}

async function issueTokenPair(
  user: { id: string; role: Role },
  meta: { userAgent?: string; ip?: string }
) {
  if (user.role === Role.SELLER) {
    await ensureSellerWorkspace(user.id)
  }
  const { orgId, membershipRole } = await resolveOrgContextForUser(user.id)
  const accessToken = signAccessToken({
    sub: user.id,
    role: user.role,
    orgId,
    membershipRole,
  })
  const rawRefresh = randomBytes(REFRESH_BYTES).toString('hex')
  await createRefreshTokenRow(user.id, rawRefresh, meta)
  return {
    accessToken,
    refreshToken: rawRefresh,
    tokenType: 'Bearer' as const,
    organizationId: orgId ?? null,
    membershipRole: membershipRole ?? null,
  }
}

export async function register(
  input: z.infer<typeof registerBody>,
  meta: { userAgent?: string; ip?: string }
) {
  const existing = await prisma.user.findFirst({
    where: { email: input.email },
  })
  if (existing) {
    throw new HttpError(409, 'Email already registered')
  }

  const passwordHash = await bcrypt.hash(input.password, 12)

  const user = await prisma.$transaction(async (tx) => {
    const u = await tx.user.create({
      data: {
        email: input.email,
        phone: input.phone,
        passwordHash,
        role: input.role,
      },
    })

    if (input.role === Role.SELLER) {
      const slug = await uniqueOrgSlug(input.companyName ?? input.email.split('@')[0] ?? 'workspace')
      const org = await tx.organization.create({
        data: {
          name: (input.companyName ?? input.email.split('@')[0] ?? 'Workspace').slice(0, 120),
          slug,
        },
      })
      await tx.organizationMember.create({
        data: {
          organizationId: org.id,
          userId: u.id,
          role: MembershipRole.SELLER,
        },
      })
      const seller = await tx.seller.create({
        data: {
          userId: u.id,
          companyName: input.companyName ?? input.email,
          organizationId: org.id,
        },
      })
      await tx.wallet.create({
        data: { sellerId: seller.id, balanceCents: 0, currency: 'INR' },
      })
    } else if (input.role === Role.CUSTOMER) {
      await tx.customer.create({
        data: {
          userId: u.id,
          fullName: input.fullName ?? input.email.split('@')[0] ?? 'Customer',
          phone: input.phone ?? '',
        },
      })
    } else if (
      input.role === Role.WORKER ||
      input.role === Role.DELIVERY_WORKER
    ) {
      await tx.worker.create({
        data: {
          userId: u.id,
          displayName: input.fullName ?? input.email.split('@')[0] ?? 'Worker',
          phone: input.phone,
        },
      })
    }

    return u
  })

  const tokens = await issueTokenPair(user, meta)
  await writeAuditLog({
    actorUserId: user.id,
    action: 'auth.register',
    resource: 'user',
    resourceId: user.id,
    metadata: { role: user.role },
    ip: meta.ip,
  })

  return {
    user: { id: user.id, email: user.email, role: user.role },
    ...tokens,
  }
}

export async function login(
  input: z.infer<typeof loginBody>,
  meta: { userAgent?: string; ip?: string }
) {
  const user = await prisma.user.findFirst({
    where: { email: input.email },
  })
  if (!user?.passwordHash) {
    await writeAuditLog({
      action: 'auth.login_failed',
      resource: 'user',
      metadata: { email: input.email, reason: 'unknown_user' },
      ip: meta.ip,
    })
    throw new HttpError(401, 'Invalid credentials')
  }
  const ok = await bcrypt.compare(input.password, user.passwordHash)
  if (!ok) {
    await writeAuditLog({
      actorUserId: user.id,
      action: 'auth.login_failed',
      resource: 'user',
      resourceId: user.id,
      metadata: { reason: 'bad_password' },
      ip: meta.ip,
    })
    throw new HttpError(401, 'Invalid credentials')
  }

  const tokens = await issueTokenPair(user, meta)
  await writeAuditLog({
    actorUserId: user.id,
    action: 'auth.login_success',
    resource: 'user',
    resourceId: user.id,
    metadata: { organizationId: tokens.organizationId },
    ip: meta.ip,
  })

  return {
    user: { id: user.id, email: user.email, role: user.role },
    ...tokens,
  }
}

export async function refresh(
  refreshToken: string,
  meta: { userAgent?: string; ip?: string }
) {
  const hash = hashRefresh(refreshToken)
  const row = await prisma.refreshToken.findUnique({
    where: { tokenHash: hash },
  })
  if (!row || row.revokedAt || row.expiresAt < new Date()) {
    await writeAuditLog({
      action: 'auth.refresh_failed',
      resource: 'refresh_token',
      metadata: { reason: 'invalid_or_expired' },
      ip: meta.ip,
    })
    throw new HttpError(401, 'Invalid or expired refresh token')
  }
  const user = await prisma.user.findUniqueOrThrow({ where: { id: row.userId } })
  await prisma.refreshToken.update({
    where: { id: row.id },
    data: { revokedAt: new Date() },
  })
  const tokens = await issueTokenPair(user, meta)
  await writeAuditLog({
    actorUserId: user.id,
    action: 'auth.refresh_success',
    resource: 'user',
    resourceId: user.id,
    ip: meta.ip,
  })
  return {
    user: { id: user.id, email: user.email, role: user.role },
    ...tokens,
  }
}

export async function logout(refreshToken: string | undefined, meta: { ip?: string }) {
  if (!refreshToken) return { ok: true as const }
  const hash = hashRefresh(refreshToken)
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hash, revokedAt: null },
    data: { revokedAt: new Date() },
  })
  await writeAuditLog({
    action: 'auth.logout',
    resource: 'refresh_token',
    ip: meta.ip,
  })
  return { ok: true as const }
}

export async function switchOrganization(
  userId: string,
  organizationId: string,
  meta: { userAgent?: string; ip?: string }
) {
  const mem = await prisma.organizationMember.findFirst({
    where: { userId, organizationId },
  })
  if (!mem) {
    throw new HttpError(403, 'Not a member of this organization')
  }
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } })
  const accessToken = signAccessToken({
    sub: user.id,
    role: user.role,
    orgId: organizationId,
    membershipRole: mem.role,
  })
  const rawRefresh = randomBytes(REFRESH_BYTES).toString('hex')
  await createRefreshTokenRow(user.id, rawRefresh, meta)
  await writeAuditLog({
    actorUserId: userId,
    action: 'auth.switch_org',
    resource: 'organization',
    resourceId: organizationId,
    ip: meta.ip,
  })
  return {
    accessToken,
    refreshToken: rawRefresh,
    tokenType: 'Bearer' as const,
    organizationId,
    membershipRole: mem.role,
  }
}
