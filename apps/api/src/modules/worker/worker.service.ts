import { OrderStatus, Role, WorkerRole } from '@prisma/client'
import { prisma } from '../../lib/prisma.js'
import { HttpError } from '../../lib/http-error.js'
import { writeAuditLog } from '../../lib/audit.js'
import {
  createWorkerBody,
  earningBody,
  workerGpsPingBody,
  adminPatchWorkerBody,
} from './worker.schema.js'
import type { z } from 'zod'

export async function listWorkers(roleFilter?: string) {
  const allowed = Object.values(WorkerRole) as string[]
  const where =
    roleFilter && allowed.includes(roleFilter)
      ? { role: roleFilter as WorkerRole }
      : undefined

  return prisma.worker.findMany({
    where,
    orderBy: { displayName: 'asc' },
    include: {
      user: { select: { email: true, phone: true } },
      homeHub: { select: { id: true, name: true, city: true, code: true } },
    },
  })
}

export async function createWorker(input: z.infer<typeof createWorkerBody>) {
  return prisma.worker.create({
    data: {
      displayName: input.displayName,
      phone: input.phone,
      role: input.role,
      userId: input.userId,
    },
  })
}

export async function earningsForWorker(workerId: string) {
  return prisma.workerEarning.findMany({
    where: { workerId },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
}

export async function workerProfileByUserId(userId: string) {
  const w = await prisma.worker.findUnique({
    where: { userId },
    select: {
      id: true,
      displayName: true,
      phone: true,
      role: true,
      isActive: true,
      userId: true,
      homeHubId: true,
      homeHub: { select: { id: true, name: true, code: true, city: true } },
    },
  })
  if (!w) throw new HttpError(404, 'Worker profile not linked to this account')
  return w
}

export async function listMyAssignedOrders(userId: string) {
  const worker = await prisma.worker.findUnique({ where: { userId } })
  if (!worker) {
    throw new HttpError(404, 'Worker profile not linked to this account')
  }
  return prisma.order.findMany({
    where: {
      OR: [{ pickupWorkerId: worker.id }, { assignedWorkerId: worker.id }],
      status: {
        notIn: [
          OrderStatus.DELIVERED,
          OrderStatus.CANCELLED,
          OrderStatus.RETURN_COMPLETED,
        ],
      },
    },
    orderBy: { updatedAt: 'desc' },
    take: 80,
    include: {
      shipment: true,
      customer: { select: { fullName: true, phone: true } },
      seller: { select: { companyName: true } },
      sourceHub: { select: { name: true, code: true } },
      destinationHub: { select: { name: true, code: true } },
    },
  })
}

export async function recordWorkerGpsPing(
  userId: string,
  input: z.infer<typeof workerGpsPingBody>
) {
  const worker = await prisma.worker.findUnique({
    where: { userId },
    select: { id: true },
  })
  if (!worker) throw new HttpError(404, 'Worker profile not linked')
  await writeAuditLog({
    actorUserId: userId,
    action: 'worker.gps_ping',
    resource: 'worker',
    resourceId: worker.id,
    metadata: {
      latitude: input.latitude,
      longitude: input.longitude,
      accuracyMeters: input.accuracyMeters ?? null,
    },
  })
}

export async function addEarning(
  workerId: string,
  input: z.infer<typeof earningBody>,
  actorRole: Role
) {
  if (actorRole !== Role.ADMIN && actorRole !== Role.SUPER_ADMIN) {
    throw new HttpError(403, 'Only platform admin can post manual earnings')
  }
  return prisma.workerEarning.create({
    data: {
      workerId,
      amountCents: input.amountCents,
      kind: input.kind,
      orderId: input.orderId,
      note: input.note,
    },
  })
}

export async function adminPatchWorker(
  workerId: string,
  input: z.infer<typeof adminPatchWorkerBody>,
  actorUserId: string
) {
  const data: {
    isVerified?: boolean
    verifiedAt?: Date | null
    verifiedBy?: string | null
    isActive?: boolean
    homeHubId?: string | null
  } = {}
  if (input.isActive !== undefined) data.isActive = input.isActive
  if (input.homeHubId !== undefined) data.homeHubId = input.homeHubId
  if (input.isVerified !== undefined) {
    data.isVerified = input.isVerified
    data.verifiedAt = input.isVerified ? new Date() : null
    data.verifiedBy = input.isVerified ? actorUserId : null
  }
  return prisma.worker.update({
    where: { id: workerId },
    data,
    include: { homeHub: { select: { id: true, name: true, city: true } } },
  })
}
