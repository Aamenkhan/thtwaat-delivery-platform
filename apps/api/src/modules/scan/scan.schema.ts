import { z } from 'zod'
import { ScanEvent } from '@prisma/client'

export const createScanBody = z.object({
  event: z.nativeEnum(ScanEvent),
  qrCode: z.string().min(1),
  workerId: z.string().min(1),
  /** Optional when device has no upload yet; server stores a placeholder proof URL. */
  photoUrl: z.string().url().optional(),
  latitude: z.number(),
  longitude: z.number(),
  timestamp: z.coerce.date(),
  hubId: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export const photoProofBody = z.object({
  publicId: z.string().min(1),
  urls: z.array(z.string().url()).min(1),
})
