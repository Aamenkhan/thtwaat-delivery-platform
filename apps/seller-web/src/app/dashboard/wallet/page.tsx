'use client'

import { apiFetch } from '@repo/web-core/api'
import { Button } from '@repo/ui'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

export default function WalletPage() {
  const qc = useQueryClient()
  const [amount, setAmount] = useState('100')
  const [msg, setMsg] = useState<string | null>(null)

  const walletQ = useQuery({
    queryKey: ['seller', 'wallet'],
    queryFn: () =>
      apiFetch<{
        data: {
          wallet: { balanceCents: number; currency: string }
          ledger: unknown[]
        }
      }>('/v1/seller/wallet'),
  })

  const payoutsQ = useQuery({
    queryKey: ['seller', 'payouts'],
    queryFn: () =>
      apiFetch<{ data: { payouts: { id: string; amountCents: number; status: string }[] } }>(
        '/v1/seller/payouts'
      ),
  })

  async function requestPayout() {
    setMsg(null)
    try {
      await apiFetch('/v1/seller/payouts', {
        method: 'POST',
        body: { amountRupees: Number(amount) },
      })
      setMsg('Payout requested.')
      void qc.invalidateQueries({ queryKey: ['seller', 'wallet'] })
      void qc.invalidateQueries({ queryKey: ['seller', 'payouts'] })
    } catch {
      setMsg('Payout failed (check balance and minimum amount).')
    }
  }

  const bal = walletQ.data?.data.wallet
  const rupees = bal ? (bal.balanceCents / 100).toFixed(2) : '—'

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold">Wallet & payouts</h1>
      {walletQ.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading wallet…</p>
      ) : (
        <section className="rounded-xl border bg-card p-6 shadow-sm">
          <p className="text-sm text-muted-foreground">Available balance</p>
          <p className="mt-2 text-3xl font-semibold">
            {bal ? `${bal.currency} ${rupees}` : '—'}
          </p>
          <div className="mt-4 flex flex-wrap items-end gap-2">
            <label className="text-sm">
              Payout (INR)
              <input
                className="ml-2 rounded-md border bg-background px-2 py-1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                type="number"
                min={1}
                step="1"
              />
            </label>
            <Button type="button" onClick={() => void requestPayout()}>
              Request payout
            </Button>
          </div>
          {msg ? <p className="mt-3 text-sm">{msg}</p> : null}
        </section>
      )}

      <section>
        <h2 className="text-lg font-semibold">Recent ledger</h2>
        <pre className="mt-2 max-h-56 overflow-auto rounded-lg border bg-muted/40 p-3 text-xs">
          {JSON.stringify(walletQ.data?.data.ledger ?? [], null, 2)}
        </pre>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Payouts</h2>
        <ul className="mt-2 divide-y rounded-lg border bg-card text-sm">
          {(payoutsQ.data?.data.payouts ?? []).map((p) => (
            <li key={p.id} className="flex justify-between px-3 py-2">
              <span>{p.id}</span>
              <span>
                {(p.amountCents / 100).toFixed(2)} · {p.status}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
