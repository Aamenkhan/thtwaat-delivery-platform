/** Response shape from https://api.postalpincode.in/pincode/{pincode} */

export type IndiaPostOffice = {
  Name: string
  District: string
  State: string
  Pincode: string
}

export type IndiaPostalPincodeBlock = {
  Status: string
  Message?: string
  PostOffice: IndiaPostOffice[] | null
}

export type IndiaPincodeLookupResult = {
  city: string
  state: string
  areas: string[]
}

export async function fetchIndiaPincodeLookup(
  pincode: string
): Promise<IndiaPincodeLookupResult | null> {
  if (!/^\d{6}$/.test(pincode)) return null
  const res = await fetch(`https://api.postalpincode.in/pincode/${pincode}`)
  if (!res.ok) return null
  const data = (await res.json()) as IndiaPostalPincodeBlock[]
  const block = Array.isArray(data) ? data[0] : null
  if (!block || block.Status !== 'Success' || !block.PostOffice?.length) {
    return null
  }
  const offices = block.PostOffice
  return {
    city: offices[0]!.District,
    state: offices[0]!.State,
    areas: offices.map((o) => o.Name),
  }
}
