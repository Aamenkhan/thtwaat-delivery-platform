'use client'

import { apiFetch } from '@repo/web-core/api'
import { readUser } from '@repo/web-core/auth-storage'
import { Button } from '@repo/ui'
import { useRef, useState } from 'react'

type RazorpayCfg = {
  keyId: string | null
  testMode: boolean
}

let scriptPromise: Promise<void> | null = null

function loadRazorpayScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  const w = window as unknown as { Razorpay?: unknown }
  if (w.Razorpay) return Promise.resolve()
  if (scriptPromise) return scriptPromise
  scriptPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://checkout.razorpay.com/v1/checkout.js'
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('Failed to load Razorpay script'))
    document.body.appendChild(s)
  })
  return scriptPromise
}

type RazorpayCtor = new (opts: Record<string, unknown>) => { open: () => void }

export type RazorpaySettled = 'success' | 'failed' | 'dismissed'

export function RazorpayCheckoutTrigger(props: {
  label: string
  createBody: Record<string, unknown>
  disabled?: boolean
  onSettled: (outcome: RazorpaySettled, message?: string) => void
}) {
  const [busy, setBusy] = useState(false)
  const successRef = useRef(false)

  async function go() {
    successRef.current = false
    setBusy(true)
    try {
      await loadRazorpayScript()
      const user = readUser()
      const cfg = await apiFetch<{ data: RazorpayCfg }>('/v1/seller/payments/razorpay/config')
      const keyFromEnv =
        typeof process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID === 'string'
          ? process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID
          : undefined
      const keyId = cfg.data.keyId ?? keyFromEnv
      if (!keyId) {
        props.onSettled('failed', 'Razorpay key missing — set RAZORPAY_KEY_ID on API and NEXT_PUBLIC_RAZORPAY_KEY_ID in seller-web for checkout.')
        return
      }

      const created = await apiFetch<{
        data: {
          razorpayOrderId: string
          amountPaise: number
          currency: string
          keyId: string | null
          description: string
        }
      }>('/v1/seller/payments/razorpay/order', {
        method: 'POST',
        body: props.createBody,
      })

      const d = created.data
      const RZP = (window as unknown as { Razorpay: RazorpayCtor }).Razorpay
      if (!RZP) {
        props.onSettled('failed', 'Razorpay SDK not available')
        return
      }

      const rzp = new RZP({
        key: d.keyId ?? keyId,
        amount: d.amountPaise,
        currency: d.currency,
        name: 'Thtwaat',
        description: d.description,
        order_id: d.razorpayOrderId,
        handler: async (response: {
          razorpay_payment_id: string
          razorpay_order_id: string
          razorpay_signature: string
        }) => {
          try {
            await apiFetch('/v1/seller/payments/razorpay/verify', {
              method: 'POST',
              body: {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              },
            })
            successRef.current = true
            props.onSettled('success')
          } catch {
            props.onSettled('failed', 'Payment succeeded but verification failed — check wallet or contact support.')
          }
        },
        modal: {
          ondismiss: () => {
            if (successRef.current) return
            props.onSettled('dismissed')
          },
        },
        prefill: {
          email: user?.email ?? '',
        },
        theme: { color: '#0f172a' },
      })
      rzp.open()
    } catch {
      props.onSettled('failed', 'Could not start checkout')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button type="button" disabled={busy || props.disabled} onClick={() => void go()}>
      {busy ? 'Opening…' : props.label}
    </Button>
  )
}
