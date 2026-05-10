import { prisma } from '../../lib/prisma.js'
import {
  buildWhatsAppBody,
  type WhatsAppTemplateKey,
} from '../../lib/whatsapp/whatsapp-templates.js'

const VALID_TEMPLATES = new Set<WhatsAppTemplateKey>([
  'shipment_booked',
  'picked_up',
  'out_for_delivery',
  'delivered',
  'cod_collected',
])
import { normalizeWhatsAppRecipient } from '../../lib/whatsapp/whatsapp-phone.js'
import { sendWhatsAppText } from '../../lib/whatsapp/whatsapp-provider.js'
import type { WhatsAppNotifyJobPayload } from '../../lib/whatsapp/whatsapp-notify.service.js'

function formatInrFromPaise(paise: number): string {
  const rupees = paise / 100
  return `₹${rupees.toLocaleString('en-IN', {
    minimumFractionDigits: rupees % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`
}

function trackingUrlBase(): string {
  const base = (process.env.PUBLIC_APP_URL ?? 'http://localhost:4000').replace(
    /\/$/,
    ''
  )
  return `${base}/v1/tracking/public`
}

export async function processWhatsAppNotify(
  payload: WhatsAppNotifyJobPayload
): Promise<void> {
  const templateKey = payload.templateKey as WhatsAppTemplateKey
  if (!VALID_TEMPLATES.has(templateKey)) {
    console.warn(`[whatsapp] Unknown templateKey: ${String(payload.templateKey)}`)
    return
  }
  const orderPublicId = payload.orderPublicId
  const extras = payload.extras ?? {}

  const order = await prisma.order.findUnique({
    where: { publicId: orderPublicId },
    include: {
      customer: true,
      shipment: true,
    },
  })
  if (!order) {
    console.warn(`[whatsapp] Order not found: ${orderPublicId}`)
    return
  }

  const phoneRaw = order.customer?.phone
  const toDigits = normalizeWhatsAppRecipient(phoneRaw)
  if (!toDigits) {
    console.warn(
      `[whatsapp] No valid phone for order ${orderPublicId} (raw: ${phoneRaw ?? 'empty'})`
    )
    return
  }

  const tid =
    order.shipment?.trackingPublicId ??
    order.shipment?.trackingNumber ??
    order.publicId
  const trackingUrl = `${trackingUrlBase()}/${encodeURIComponent(tid)}/timeline`

  const codPaise = order.codAmountCents ?? 0
  const codDisplay =
    extras.codDisplay ??
    (codPaise > 0 ? formatInrFromPaise(codPaise) : undefined)

  const body = buildWhatsAppBody(templateKey, {
    publicId: order.publicId,
    customerName: order.customer?.fullName,
    trackingRef:
      order.shipment?.trackingNumber ??
      order.shipment?.trackingPublicId ??
      null,
    trackingUrl,
    codDisplay: codDisplay ?? null,
  })

  const branded = `*Thtwaat*\n\n${body}`
  await sendWhatsAppText({ toDigits, body: branded })
}
