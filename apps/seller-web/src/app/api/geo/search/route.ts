import { searchAddress } from '@/lib/geo.service'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const q = (searchParams.get('q') ?? '').trim()
  const city = (searchParams.get('city') ?? '').trim() || undefined

  if (q.length < 3) {
    return NextResponse.json({ ok: true as const, data: { results: [] as unknown[] } })
  }
  if (q.length > 280) {
    return NextResponse.json(
      { ok: false as const, error: { message: 'Query too long' } },
      { status: 400 }
    )
  }

  try {
    const results = await searchAddress(q, city)
    return NextResponse.json({ ok: true as const, data: { results } })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Search failed'
    return NextResponse.json({ ok: false as const, error: { message } }, { status: 502 })
  }
}
