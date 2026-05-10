'use client'

import { apiFetch } from '@repo/web-core/api'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { RazorpayCheckoutTrigger, type RazorpaySettled } from '../../../components/razorpay-checkout-trigger'

type Plan = {
  code: 'BASIC' | 'PRO' | 'ENTERPRISE'
  label: string
  amountPaise: number
  periodDays: number
}

export default function PlansPage() {
  const qc = useQueryClient()
  const [msg, setMsg] = useState<string | null>(null)

  const plansQ = useQuery({
    queryKey: ['seller', 'plans'],
    queryFn: () =>
      apiFetch<{ data: { plans: Plan[] } }>('/v1/seller/payments/subscription/plans'),
  })

  const subQ = useQuery({
    queryKey: ['seller', 'subscription'],
    queryFn: () =>
      apiFetch<{
        data: {
          subscription: {
            planCode: string
            status: string
            currentPeriodEnd: string
          } | null
        }
      }>('/v1/seller/payments/subscription'),
  })

  function onSettled(plan: Plan, outcome: RazorpaySettled, detail?: string) {
    if (outcome === 'success') {
      setMsg(`Subscribed to ${plan.label}.`)
      void qc.invalidateQueries({ queryKey: ['seller', 'subscription'] })
    } else if (outcome === 'failed') {
      setMsg(detail ?? 'Payment failed.')
    } else {
      setMsg('Checkout closed.')
    }
  }

  const active = subQ.data?.data.subscription

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold">Subscription plans</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Test mode: use Razorpay test cards (e.g. success <code className="rounded bg-muted px-1">4111 1111 1111 1111</code>).
        </p>
      </div>

      {active ? (
        <section className="rounded-xl border bg-card p-4 text-sm">
          <p className="font-medium">Current plan</p>
          <p className="mt-1">
            {active.planCode} · active until{' '}
            {new Date(active.currentPeriodEnd).toLocaleDateString()}
          </p>
        </section>
      ) : (
        <p className="text-sm text-muted-foreground">No active subscription.</p>
      )}

      {msg ? <p className="text-sm">{msg}</p> : null}

      <ul className="grid gap-4 sm:grid-cols-3">
        {(plansQ.data?.data.plans ?? []).map((plan) => (
          <li key={plan.code} className="rounded-xl border bg-card p-5 shadow-sm">
            <h2 className="text-lg font-semibold">{plan.label}</h2>
            <p className="mt-2 text-2xl font-semibold">
              ₹{(plan.amountPaise / 100).toFixed(0)}
            </p>
            <p className="text-xs text-muted-foreground">per {plan.periodDays} days</p>
            <div className="mt-4">
              <RazorpayCheckoutTrigger
                label={`Pay ${plan.label}`}
                createBody={{ purpose: 'SUBSCRIPTION', planCode: plan.code }}
                onSettled={(o, m) => onSettled(plan, o, m)}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
