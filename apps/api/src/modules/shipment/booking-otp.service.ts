import { randomInt } from 'node:crypto'
import { prisma } from '../../lib/prisma.js'
import { hashOtpCode } from '../otp/otp.service.js'
import { sendWhatsAppText } from '../../lib/whatsapp/whatsapp-provider.js'

export const DELIVERY_BOOKING_OTP_PURPOSE = 'DELIVERY_BOOKING'

function normalizePhone(raw: string) {
  return raw.replace(/\s+/g, '')
}

function digitsForWhatsApp(phone: string) {
  return phone.replace(/^\+/, '').replace(/\D/g, '')
}

export function maskIndianPhone(phone: string): string {
  const d = digitsForWhatsApp(phone)
  if (d.length <= 4) return '****'
  const mid = Math.max(0, d.length - 4)
  return `${d.slice(0, 2)}${'X'.repeat(mid)}${d.slice(-2)}`
}

/**
 * Persists a 6-digit OTP for customer delivery confirmation, logs SMS stub,
 * and optionally sends WhatsApp when Cloud API env is configured.
 */
export async function sendCustomerBookingOtp(params: {
  orderId: string
  phone: string
}): Promise<{ maskedPhone: string }> {
  const phone = normalizePhone(params.phone)
  const code = String(randomInt(100000, 999999))
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000)

  await prisma.oTPVerification.create({
    data: {
      phone,
      codeHash: hashOtpCode(code, phone),
      purpose: DELIVERY_BOOKING_OTP_PURPOSE,
      expiresAt,
      orderId: params.orderId,
    },
  })

  console.log(
    `[sms-stub] delivery booking OTP order=${params.orderId} phone=${maskIndianPhone(phone)} code=${code}`
  )

  const waBody = `Your Thtwaat delivery verification code is ${code}. Valid for 15 minutes.`

  try {
    const toDigits = digitsForWhatsApp(phone)
    if (toDigits.length >= 10) {
      await sendWhatsAppText({ toDigits, body: waBody })
    }
  } catch (e) {
    console.warn('[booking-otp] WhatsApp send skipped or failed:', e)
  }

  return { maskedPhone: maskIndianPhone(phone) }
}
