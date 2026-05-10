export type WhatsAppTemplateKey =
  | 'shipment_booked'
  | 'picked_up'
  | 'out_for_delivery'
  | 'delivered'
  | 'cod_collected'

export type WhatsAppTemplateContext = {
  publicId: string
  customerName?: string | null
  trackingRef?: string | null
  trackingUrl?: string | null
  /** Pre-formatted COD for display, e.g. "₹499.00" */
  codDisplay?: string | null
}

function greet(name: string | null | undefined) {
  const n = name?.trim()
  if (n) return n.split(/\s+/)[0] ?? n
  return null
}

function lines(parts: { en: string; hi: string }): string {
  return `*English*\n${parts.en}\n\n*हिंदी*\n${parts.hi}`
}

export function buildWhatsAppBody(
  key: WhatsAppTemplateKey,
  ctx: WhatsAppTemplateContext
): string {
  const who = greet(ctx.customerName)
  const dearEn = who ? `Hi ${who}, ` : 'Hi, '
  const dearHi = who ? `नमस्ते ${who}, ` : 'नमस्ते, '
  const track =
    ctx.trackingUrl && ctx.trackingRef
      ? `${ctx.trackingRef}: ${ctx.trackingUrl}`
      : ctx.trackingRef ?? ctx.trackingUrl ?? ctx.publicId

  switch (key) {
    case 'shipment_booked':
      return lines({
        en: `${dearEn}your shipment is booked with Thtwaat. Order: ${ctx.publicId}. Track: ${track}.`,
        hi: `${dearHi}आपका शिपमेंट Thtwaat पर बुक हो गया है। ऑर्डर: ${ctx.publicId}। ट्रैक करें: ${track}।`,
      })
    case 'picked_up':
      return lines({
        en: `${dearEn}your parcel has been picked up. Order: ${ctx.publicId}. Track: ${track}.`,
        hi: `${dearHi}आपका पार्सल पिकअप हो चुका है। ऑर्डर: ${ctx.publicId}। ट्रैक करें: ${track}।`,
      })
    case 'out_for_delivery':
      return lines({
        en: `${dearEn}your parcel is out for delivery. Order: ${ctx.publicId}. Track: ${track}.`,
        hi: `${dearHi}आपका पार्सल डिलीवरी के लिए निकल चुका है। ऑर्डर: ${ctx.publicId}। ट्रैक करें: ${track}।`,
      })
    case 'delivered':
      return lines({
        en: `${dearEn}your parcel has been delivered. Order: ${ctx.publicId}. Thank you for choosing Thtwaat.`,
        hi: `${dearHi}आपका पार्सल डिलीवर हो गया है। ऑर्डर: ${ctx.publicId}। Thtwaat चुनने के लिए धन्यवाद।`,
      })
    case 'cod_collected': {
      const cod = ctx.codDisplay ?? 'the COD amount'
      return lines({
        en: `${dearEn}cash on delivery (${cod}) was collected for order ${ctx.publicId}. Thank you.`,
        hi: `${dearHi}ऑर्डर ${ctx.publicId} के लिए कैश ऑन डिलीवरी (${cod}) प्राप्त कर ली गई है। धन्यवाद।`,
      })
    }
  }
}
