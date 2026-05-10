import { OrderStatus } from '@prisma/client'
import { domainEvents } from '../lib/events.js'
import type { WhatsAppTemplateKey } from '../lib/whatsapp/whatsapp-templates.js'
import { enqueueWhatsAppNotify } from '../lib/whatsapp/whatsapp-notify.service.js'

let registered = false

function mapStatusToTemplate(to: OrderStatus): WhatsAppTemplateKey | null {
  switch (to) {
    case OrderStatus.PICKED_UP:
      return 'picked_up'
    case OrderStatus.OUT_FOR_DELIVERY:
      return 'out_for_delivery'
    case OrderStatus.DELIVERED:
      return 'delivered'
    default:
      return null
  }
}

export function registerWhatsAppBridge() {
  if (registered) return
  registered = true

  domainEvents.on('order:booked', (p) => {
    void enqueueWhatsAppNotify({
      templateKey: 'shipment_booked',
      orderPublicId: p.publicId,
    }).catch(console.error)
  })

  domainEvents.on('order:status:changed', (p) => {
    const key = mapStatusToTemplate(p.to)
    if (!key) return
    void enqueueWhatsAppNotify({
      templateKey: key,
      orderPublicId: p.publicId,
    }).catch(console.error)
  })
}
