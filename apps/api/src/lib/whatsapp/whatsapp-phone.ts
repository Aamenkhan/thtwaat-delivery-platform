/**
 * Normalize customer phone to WhatsApp / Meta `to` field (digits, country code, no +).
 * Defaults to India (+91) when input looks like a 10-digit mobile.
 */
export function normalizeWhatsAppRecipient(raw: string | null | undefined): string | null {
  if (!raw) return null
  const digits = raw.replace(/\D/g, '')
  if (digits.length < 10) return null

  if (digits.length === 10) {
    const first = digits[0]
    if (first === '6' || first === '7' || first === '8' || first === '9') {
      return `91${digits}`
    }
    return null
  }

  if (digits.startsWith('91') && digits.length === 12) return digits
  if (digits.startsWith('0') && digits.length === 11) {
    const rest = digits.slice(1)
    if (rest.length === 10) return `91${rest}`
  }

  if (digits.length >= 11 && digits.length <= 15) return digits
  return null
}
