import type { Prisma } from '@prisma/client'
import { enqueueJob } from '../queue/integration-jobs.js'
import type { WhatsAppTemplateKey } from './whatsapp-templates.js'

export type WhatsAppNotifyJobPayload = {
  templateKey: WhatsAppTemplateKey
  orderPublicId: string
  extras?: Record<string, string>
}

export async function enqueueWhatsAppNotify(input: {
  templateKey: WhatsAppTemplateKey
  orderPublicId: string
  extras?: Record<string, string>
}) {
  const payload: WhatsAppNotifyJobPayload = {
    templateKey: input.templateKey,
    orderPublicId: input.orderPublicId,
    extras: input.extras,
  }
  await enqueueJob({
    type: 'WHATSAPP_NOTIFY',
    payload: payload as unknown as Prisma.InputJsonValue,
  })
}
