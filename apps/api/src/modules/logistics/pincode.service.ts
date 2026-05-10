import { prisma } from '../../lib/prisma.js'
import { HttpError } from '../../lib/http-error.js'

const PIN_RE = /^\d{6}$/

export function normalizePincode(raw: string): string {
  const s = raw.replace(/\s+/g, '')
  if (!PIN_RE.test(s)) {
    throw new HttpError(400, 'Pincode must be a 6-digit string')
  }
  return s
}

export async function lookupPincode(pincode: string) {
  const pc = normalizePincode(pincode)
  const row = await prisma.pincodeDirectory.findUnique({
    where: { pincode: pc },
    include: { serviceHub: true },
  })
  if (!row?.active) {
    throw new HttpError(
      404,
      `Pincode ${pc} is not in the serviceable directory (run DB seed or use a seeded PIN).`
    )
  }
  return row
}

export async function listPincodesByCity(city: string) {
  return prisma.pincodeDirectory.findMany({
    where: { city: { equals: city, mode: 'insensitive' }, active: true },
    include: { serviceHub: true },
  })
}
