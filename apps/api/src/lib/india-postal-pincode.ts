type PostalBlock = {
  Status: string
  PostOffice?: Array<{ Name: string; District: string; State: string; Pincode: string }> | null
}

export type IndiaPostalLookup = { city: string; state: string; area: string }

/**
 * India Post pincode directory (no API key).
 * Used as server-side fallback when city/state omitted.
 */
export async function lookupIndiaPostalPincode(
  pincode: string
): Promise<IndiaPostalLookup | null> {
  if (!/^\d{6}$/.test(pincode)) return null
  try {
    const res = await fetch(`https://api.postalpincode.in/pincode/${pincode}`, {
      signal: AbortSignal.timeout(12_000),
      headers: { 'User-Agent': 'Thtwaat-Delivery-App' },
    })
    if (!res.ok) return null
    const data = (await res.json()) as PostalBlock[]
    const block = Array.isArray(data) ? data[0] : null
    if (!block || block.Status !== 'Success' || !block.PostOffice?.length) {
      return null
    }
    const o = block.PostOffice[0]!
    return {
      city: o.District,
      state: o.State,
      area: o.Name,
    }
  } catch {
    return null
  }
}
