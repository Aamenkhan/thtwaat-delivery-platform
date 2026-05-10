import { randomBytes } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import { HttpError } from './http-error.js'

export async function allocTrackingNumber(
  tx: Prisma.TransactionClient
): Promise<string> {
  for (let i = 0; i < 24; i++) {
    const code = `TW-${randomBytes(4).toString('hex').toUpperCase()}`
    const clash = await tx.shipment.findFirst({
      where: { trackingNumber: code },
      select: { id: true },
    })
    if (!clash) return code
  }
  throw new HttpError(500, 'Could not allocate tracking number')
}
