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

/** Directory row for routing / pricing, or `null` if not seeded (booking may still proceed). */
export async function findPincodeDirectory(pincode: string) {
  const pc = normalizePincode(pincode)
  const row = await prisma.pincodeDirectory.findUnique({
    where: { pincode: pc },
    include: { serviceHub: true },
  })
  if (!row?.active) return null
  return row
}

export async function listPincodesByCity(city: string) {
  return prisma.pincodeDirectory.findMany({
    where: { city: { equals: city, mode: 'insensitive' }, active: true },
    include: { serviceHub: true },
  })
}
