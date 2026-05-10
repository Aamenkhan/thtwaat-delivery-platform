import type { Prisma } from '@prisma/client'
import { IntegrationJobStatus } from '@prisma/client'
import { prisma } from '../prisma.js'
import { sleep } from '../retry.js'
import * as shopifyJobs from '../../modules/shopify/shopify.jobs.js'
import * as wooJobs from '../../modules/woocommerce/woocommerce.jobs.js'
import * as whatsappJobs from '../../modules/whatsapp/whatsapp.jobs.js'

export function backoffMs(attempts: number) {
  return Math.min(60 * 60 * 1000, 1000 * 2 ** Math.min(attempts, 12))
}

export async function enqueueJob(input: {
  type: string
  payload: Prisma.InputJsonValue
  sellerId?: string
  storeId?: string
}) {
  return prisma.integrationJob.create({
    data: {
      type: input.type,
      payload: input.payload,
      sellerId: input.sellerId,
      storeId: input.storeId,
      status: IntegrationJobStatus.PENDING,
      runAfter: new Date(),
    },
  })
}

export async function runOneJob(): Promise<boolean> {
  const job = await prisma.integrationJob.findFirst({
    where: {
      status: IntegrationJobStatus.PENDING,
      runAfter: { lte: new Date() },
    },
    orderBy: { runAfter: 'asc' },
  })
  if (!job) return false

  await prisma.integrationJob.update({
    where: { id: job.id },
    data: { status: IntegrationJobStatus.RUNNING },
  })

  try {
    switch (job.type) {
      case 'SHOPIFY_PUSH_TRACKING':
        await shopifyJobs.pushTracking(job.payload as never)
        break
      case 'SHOPIFY_RETURN_SYNC':
        await shopifyJobs.syncReturn(job.payload as never)
        break
      case 'WOOCOMMERCE_SHIPMENT_SYNC':
        await wooJobs.syncShipment(job.payload as never)
        break
      case 'WOOCOMMERCE_IMPORT_ORDERS':
        await wooJobs.importOrders(job.payload as never)
        break
      case 'WHATSAPP_NOTIFY':
        await whatsappJobs.processWhatsAppNotify(job.payload as never)
        break
      default:
        throw new Error(`Unknown job type: ${job.type}`)
    }

    await prisma.integrationJob.update({
      where: { id: job.id },
      data: { status: IntegrationJobStatus.COMPLETED, lastError: null },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'error'
    const attempts = job.attempts + 1
    const dead = attempts >= job.maxAttempts
    await prisma.integrationJob.update({
      where: { id: job.id },
      data: {
        status: dead
          ? IntegrationJobStatus.DEAD
          : IntegrationJobStatus.PENDING,
        attempts,
        lastError: msg,
        runAfter: dead ? undefined : new Date(Date.now() + backoffMs(attempts)),
      },
    })
  }

  return true
}

export async function integrationWorkerLoop() {
  for (;;) {
    const ran = await runOneJob()
    if (!ran) await sleep(2000)
  }
}
