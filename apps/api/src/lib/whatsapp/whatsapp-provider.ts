/**
 * Meta WhatsApp Cloud API — plain text messages.
 * @see https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-messages
 */

function graphBase(): string {
  return (
    process.env.WHATSAPP_GRAPH_API_BASE?.replace(/\/$/, '') ??
    'https://graph.facebook.com'
  )
}

export function isWhatsAppConfigured(): boolean {
  const token =
    process.env.WHATSAPP_ACCESS_TOKEN?.trim() ||
    process.env.WABUSINESS_TOKEN?.trim()
  return Boolean(token && process.env.WHATSAPP_PHONE_NUMBER_ID)
}

/** E.164 without + prefix (Meta expects digits only). */
export async function sendWhatsAppText(params: {
  toDigits: string
  body: string
}): Promise<void> {
  const token =
    process.env.WHATSAPP_ACCESS_TOKEN?.trim() ||
    process.env.WABUSINESS_TOKEN?.trim()
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  if (!token || !phoneNumberId) {
    console.warn(
      '[whatsapp] Skip send: set WHATSAPP_ACCESS_TOKEN or WABUSINESS_TOKEN, plus WHATSAPP_PHONE_NUMBER_ID'
    )
    return
  }

  const version = process.env.WHATSAPP_GRAPH_API_VERSION ?? 'v20.0'
  const url = `${graphBase()}/${version}/${phoneNumberId}/messages`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: params.toDigits,
      type: 'text',
      text: { preview_url: true, body: params.body },
    }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(
      `WhatsApp API ${res.status}: ${text.slice(0, 500) || res.statusText}`
    )
  }
}
