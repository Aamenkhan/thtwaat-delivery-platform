import { fetchIndiaPincodeLookup } from '@repo/web-core/india-pincode'
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
    const row = await fetchIndiaPincodeLookup(pc)
    if (!row) {
      return NextResponse.json({
        ok: true as const,
        data: null,
      })
    }
    return NextResponse.json({
      ok: true as const,
      data: {
        pincode: pc,
        city: row.city,
        state: row.state,
        areas: row.areas,
      },
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Pincode lookup failed'
    return NextResponse.json({ ok: false as const, error: { message } }, { status: 502 })
  }
}
