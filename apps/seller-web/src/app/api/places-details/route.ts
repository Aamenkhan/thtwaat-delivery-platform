import { placesGetDetailsNew, resolvePlacesApiKey } from '@/lib/places-server'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

type Body = { placeId?: unknown; sessionToken?: unknown }

export async function POST(req: Request) {
  if (!resolvePlacesApiKey()) {
    return NextResponse.json(
      { ok: false as const, error: { code: 'PLACES_NOT_CONFIGURED', message: 'Places API key not configured.' } },
      { status: 501 }
    )
  }

  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return NextResponse.json(
      { ok: false as const, error: { message: 'Invalid JSON body' } },
      { status: 400 }
    )
  }

  const placeId = typeof body.placeId === 'string' ? body.placeId.trim() : ''
  const sessionToken = typeof body.sessionToken === 'string' ? body.sessionToken : ''
  if (!placeId || !sessionToken || sessionToken.length > 36) {
    return NextResponse.json(
      { ok: false as const, error: { message: 'placeId and sessionToken required' } },
      { status: 400 }
    )
  }

  try {
    const place = await placesGetDetailsNew(placeId, sessionToken)
    return NextResponse.json({ ok: true as const, data: { place } })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Place details failed'
    return NextResponse.json({ ok: false as const, error: { message } }, { status: 502 })
  }
}
