import { reverseGeocode } from '@/lib/geo.service'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const lat = Number(searchParams.get('lat'))
  const lon = Number(searchParams.get('lon'))
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return NextResponse.json(
      { ok: false as const, error: { message: 'lat and lon required' } },
      { status: 400 }
    )
  }
  try {
    const place = await reverseGeocode(lat, lon)
    return NextResponse.json({ ok: true as const, data: { place } })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Reverse geocode failed'
    return NextResponse.json({ ok: false as const, error: { message } }, { status: 502 })
  }
}
