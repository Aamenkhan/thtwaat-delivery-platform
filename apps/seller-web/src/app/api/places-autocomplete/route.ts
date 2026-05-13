import { placesAutocompleteNew, resolvePlacesApiKey } from '@/lib/places-server'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

type Body = { input?: unknown; sessionToken?: unknown }

export async function POST(req: Request) {
  if (!resolvePlacesApiKey()) {
    return NextResponse.json(
      { ok: false as const, error: { code: 'PLACES_NOT_CONFIGURED', message: 'Set GOOGLE_PLACES_API_KEY or GOOGLE_MAPS_GEOCODING_API_KEY with Places API (New) enabled.' } },
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

  const input = typeof body.input === 'string' ? body.input : ''
  const sessionToken = typeof body.sessionToken === 'string' ? body.sessionToken : ''
  if (!sessionToken || sessionToken.length > 36) {
    return NextResponse.json(
      { ok: false as const, error: { message: 'sessionToken required (max 36 chars)' } },
      { status: 400 }
    )
  }
  if (input.trim().length < 2) {
    return NextResponse.json({ ok: true as const, data: { suggestions: [] as { placeId: string; mainText: string; secondaryText: string }[] } })
  }
  if (input.length > 200) {
    return NextResponse.json(
      { ok: false as const, error: { message: 'Input too long' } },
      { status: 400 }
    )
  }

  try {
    const suggestions = await placesAutocompleteNew(input, sessionToken)
    return NextResponse.json({ ok: true as const, data: { suggestions } })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Autocomplete failed'
    return NextResponse.json({ ok: false as const, error: { message } }, { status: 502 })
  }
}
