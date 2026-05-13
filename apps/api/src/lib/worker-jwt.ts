import jwt, { type SignOptions } from 'jsonwebtoken'
import type { Role, WorkerRole } from '@prisma/client'

const secret = () => {
  const s = process.env.JWT_SECRET
  if (!s) throw new Error('JWT_SECRET is not set')
  return s
}

const workerTtl =
  process.env.JWT_WORKER_EXPIRES_IN ??
  (process.env.NODE_ENV === 'production' ? '30d' : '30d')

export type WorkerJwtPayload = {
  sub: string
  role: Role
  hubId: string | null
  workerRole: WorkerRole
  typ: 'worker'
}

type Inner = WorkerJwtPayload & jwt.JwtPayload

export function signWorkerJwt(input: {
  workerId: string
  hubId: string | null
  appRole: Role
  workerRole: WorkerRole
}) {
  const options: SignOptions = {
    expiresIn: workerTtl as SignOptions['expiresIn'],
  }
  return jwt.sign(
    {
      sub: input.workerId,
      role: input.appRole,
      hubId: input.hubId,
      workerRole: input.workerRole,
      typ: 'worker',
    },
    secret(),
    options
  )
}

export function verifyWorkerJwt(token: string): WorkerJwtPayload {
  const decoded = jwt.verify(token, secret()) as Inner
  if (decoded.typ !== 'worker' || typeof decoded.sub !== 'string') {
    throw new Error('Invalid worker token')
  }
  if (decoded.role !== 'WORKER' && decoded.role !== 'DELIVERY_WORKER') {
    throw new Error('Invalid worker token role')
  }
  return {
    sub: decoded.sub,
    role: decoded.role,
    hubId: typeof decoded.hubId === 'string' ? decoded.hubId : null,
    workerRole: decoded.workerRole as WorkerRole,
    typ: 'worker',
  }
}
