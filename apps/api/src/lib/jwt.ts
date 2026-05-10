import jwt, { type SignOptions } from 'jsonwebtoken'
import type { MembershipRole, Role } from '@prisma/client'

const secret = () => {
  const s = process.env.JWT_SECRET
  if (!s) throw new Error('JWT_SECRET is not set')
  return s
}

const accessTtl =
  process.env.JWT_ACCESS_EXPIRES_IN ??
  (process.env.NODE_ENV === 'production' ? '15m' : '24h')

export type AccessTokenPayload = {
  sub: string
  role: Role
  /** Active workspace for tenant-scoped APIs. */
  orgId?: string
  /** Role within `orgId` when present. */
  membershipRole?: MembershipRole
}

type JwtPayloadInner = AccessTokenPayload & jwt.JwtPayload

export function signAccessToken(payload: AccessTokenPayload) {
  const options: SignOptions = { expiresIn: accessTtl as jwt.SignOptions['expiresIn'] }
  return jwt.sign(
    {
      sub: payload.sub,
      role: payload.role,
      ...(payload.orgId ? { orgId: payload.orgId } : {}),
      ...(payload.membershipRole ? { membershipRole: payload.membershipRole } : {}),
    },
    secret(),
    options
  )
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const decoded = jwt.verify(token, secret()) as JwtPayloadInner
  if (typeof decoded.sub !== 'string' || decoded.role == null) {
    throw new Error('Invalid token payload')
  }
  return {
    sub: decoded.sub,
    role: decoded.role,
    orgId: typeof decoded.orgId === 'string' ? decoded.orgId : undefined,
    membershipRole:
      typeof decoded.membershipRole === 'string' ?
        (decoded.membershipRole as MembershipRole)
      : undefined,
  }
}
