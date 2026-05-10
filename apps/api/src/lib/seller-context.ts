import type { Request } from 'express'
import { MembershipRole } from '@prisma/client'
import { prisma } from './prisma.js'
import { HttpError } from './http-error.js'

function canManageCommerce(role: MembershipRole) {
  return (
    role === MembershipRole.SELLER || role === MembershipRole.HUB_MANAGER
  )
}

/**
 * Resolves the tenant `Seller` for the active organization (JWT `orgId`).
 * SELLER membership: own `Seller` row must belong to that org.
 * HUB_MANAGER: uses the org's primary seller row (oldest in org).
 */
export async function requireSellerFromRequest(req: Request) {
  if (!req.auth) throw new HttpError(401, 'Unauthorized')
  if (!req.auth.orgId) {
    throw new HttpError(
      400,
      'Active organization required — login again or call POST /v1/auth/switch-org'
    )
  }

  const mem = await prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: {
        organizationId: req.auth.orgId,
        userId: req.auth.userId,
      },
    },
  })
  if (!mem || !canManageCommerce(mem.role)) {
    throw new HttpError(403, 'No commerce access for this organization')
  }

  if (mem.role === MembershipRole.SELLER) {
    const seller = await prisma.seller.findUnique({
      where: { userId: req.auth.userId },
    })
    if (!seller || seller.organizationId !== req.auth.orgId) {
      throw new HttpError(403, 'Seller workspace mismatch')
    }
    return seller
  }

  const seller = await prisma.seller.findFirst({
    where: { organizationId: req.auth.orgId },
    orderBy: { createdAt: 'asc' },
  })
  if (!seller) throw new HttpError(404, 'Seller profile not found for workspace')
  return seller
}

/** Requires JWT user to own the seller row (not hub manager acting on org seller). */
export async function requirePrimarySellerFromRequest(req: Request) {
  const seller = await requireSellerFromRequest(req)
  if (seller.userId !== req.auth!.userId) {
    throw new HttpError(403, 'Primary seller account required')
  }
  return seller
}
