import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

export function hashApiKey(raw: string): string {
  return createHash('sha256').update(raw).digest('hex')
}

export function newApiKeyRaw(): string {
  return `pk_live_${randomBytes(24).toString('base64url')}`
}

export function hashOtpCode(code: string, phone: string): string {
  const pepper = process.env.OTP_PEPPER ?? 'dev-pepper'
  return createHash('sha256')
    .update(`${pepper}:${phone}:${code}`)
    .digest('hex')
}

export function timingSafeEqualHex(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, 'hex')
    const bb = Buffer.from(b, 'hex')
    if (ba.length !== bb.length) return false
    return timingSafeEqual(ba, bb)
  } catch {
    return false
  }
}
