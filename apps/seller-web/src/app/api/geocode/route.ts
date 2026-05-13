import { geocodeAddress } from '@/lib/geocode-server'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

type Body = { address?: unknown }

export async function POST(req: Request) {
  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return NextResponse.json(
      { ok: false as const, error: { message: 'Invalid JSON body' } },
      { status: 400 }
    )
  }

  const address = typeof body.address === 'string' ? body.address.trim() : ''
  if (address.length < 8) {
    return NextResponse.json(
      { ok: false as const, error: { message: 'Address must be at least 8 characters' } },
      { status: 400 }
    )
  }
  if (address.length > 500) {
    return NextResponse.json(
      { ok: false as const, error: { message: 'Address is too long' } },
      { status: 400 }
    )
  }

  try {
    const data = await geocodeAddress(address)
    return NextResponse.json({ ok: true as const, data })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Geocoding failed'
    return NextResponse.json({ ok: false as const, error: { message } }, { status: 502 })
  }
}
