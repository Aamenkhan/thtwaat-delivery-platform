import { resolvePlacesApiKey } from '@/lib/places-server'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function GET() {
  const enabled = Boolean(resolvePlacesApiKey())
  return NextResponse.json({ ok: true as const, data: { placesAutocompleteEnabled: enabled } })
}
