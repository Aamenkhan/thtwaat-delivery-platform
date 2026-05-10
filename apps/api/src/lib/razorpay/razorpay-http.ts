import { HttpError } from '../http-error.js'

type RazorpayOrderResponse = {
  id: string
  amount: number
  currency: string
  receipt?: string
  status?: string
  error?: { code?: string; description?: string }
}

function authHeader(): string {
  const keyId = process.env.RAZORPAY_KEY_ID
  const keySecret = process.env.RAZORPAY_KEY_SECRET
  if (!keyId || !keySecret) {
    throw new HttpError(503, 'Razorpay is not configured (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET)')
  }
  return `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`
}

export async function razorpayCreateOrderApi(input: {
  amountPaise: number
  receipt: string
  notes: Record<string, string>
}): Promise<RazorpayOrderResponse> {
  const res = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      Authorization: authHeader(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: input.amountPaise,
      currency: 'INR',
      receipt: input.receipt.slice(0, 40),
      payment_capture: 1,
      notes: input.notes,
    }),
  })
  const data = (await res.json()) as RazorpayOrderResponse
  if (!res.ok || data.error) {
    const msg =
      data.error?.description ?? data.error?.code ?? `Razorpay HTTP ${res.status}`
    throw new HttpError(502, `Razorpay order failed: ${msg}`)
  }
  return data
}

export function getRazorpayPublishableKeyId(): string | null {
  const k = process.env.RAZORPAY_KEY_ID?.trim()
  return k && k.startsWith('rzp_') ? k : null
}
