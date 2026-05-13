import { lookupPincode } from '@/lib/geo.service'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

type Ctx = { params: Promise<{ pincode: string }> }

export async function GET(_req: Request, ctx: Ctx) {
  const { pincode } = await ctx.params
  const pc = pincode?.replace(/\D/g, '').slice(0, 6) ?? ''
  if (!/^\d{6}$/.test(pc)) {
    return NextResponse.json(
      { ok: false as const, error: { message: 'Invalid pincode' } },
      { status: 400 }
    )
  }
  try {
    const data = await lookupPincode(pc)
    if (!data) {
      return NextResponse.json({ ok: true as const, data: null })
    }
    return NextResponse.json({ ok: true as const, data })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Pincode lookup failed'
    return NextResponse.json({ ok: false as const, error: { message } }, { status: 502 })
  }
}
