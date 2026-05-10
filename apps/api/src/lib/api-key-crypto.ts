import { createHash, randomBytes } from 'node:crypto'

export function hashApiKey(raw: string): string {
  return createHash('sha256').update(raw).digest('hex')
}

export function newApiKeyRaw(): string {
  return `pk_live_${randomBytes(24).toString('base64url')}`
}
