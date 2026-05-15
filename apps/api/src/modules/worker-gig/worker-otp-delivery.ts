import { isWhatsAppConfigured, sendWhatsAppText } from '../../lib/whatsapp/whatsapp-provider.js'
import { normalizeWhatsAppRecipient } from '../../lib/whatsapp/whatsapp-phone.js'
import { maskPhone } from './worker-gig.utils.js'

export function shouldExposeWorkerOtpInApi(): boolean {
  return (
    process.env.NODE_ENV !== 'production' || process.env.WORKER_OTP_DEV_EXPOSE === '1'
  )
}

/** Store / match Indian mobiles as 10 digits when possible. */
export function normalizeWorkerPhoneDigits(raw: string): string {
  let d = raw.replace(/\D/g, '')
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2)
  if (d.length === 11 && d.startsWith('0')) d = d.slice(1)
  return d
}

export function workerPhoneLookupVariants(digits: string): string[] {
  const base = normalizeWorkerPhoneDigits(digits)
  const set = new Set<string>()
  if (base) set.add(base)
  if (base.length === 10) set.add(`91${base}`)
  return [...set]
}

/** OTP is always logged; WhatsApp when Meta env is set. */
export async function deliverWorkerOtp(
  phoneDigits: string,
  otp: string,
  purpose: 'login' | 'register'
): Promise<{ delivered: 'whatsapp' | 'log_only' }> {
  const label = purpose === 'login' ? 'login' : 'registration'
  console.log(`[worker-${purpose}] OTP for ${phoneDigits}: ${otp}`)

  const to = normalizeWhatsAppRecipient(phoneDigits)
  if (to && isWhatsAppConfigured()) {
    try {
      await sendWhatsAppText({
        toDigits: to,
        body: `*Thtwaat Worker*\n\nYour ${label} OTP is: *${otp}*\nValid for 10 minutes. Do not share this code.`,
      })
      return { delivered: 'whatsapp' }
    } catch (e) {
      console.error('[worker-otp] WhatsApp send failed:', e)
    }
  } else if (!isWhatsAppConfigured()) {
    console.warn(
      '[worker-otp] WhatsApp not configured — OTP only in server logs. Set WHATSAPP_ACCESS_TOKEN + WHATSAPP_PHONE_NUMBER_ID on API.'
    )
  }

  return { delivered: 'log_only' }
}

export function workerOtpSentPayload(phoneDigits: string, otp: string, delivered: 'whatsapp' | 'log_only') {
  const masked = maskPhone(phoneDigits)
  const message =
    delivered === 'whatsapp'
      ? `OTP sent to ${masked} on WhatsApp`
      : `OTP generated for ${masked}. Check API server logs (Render → Logs) until WhatsApp is configured.`

  return {
    message,
    ...(shouldExposeWorkerOtpInApi() ? { _devOtp: otp } : {}),
    delivery: delivered,
  }
}
