import type { ApiKey } from '@prisma/client'

export type ApiKeyContext = Pick<
  ApiKey,
  'id' | 'sellerId' | 'hubId' | 'scopes'
>

declare module 'hono' {
  interface ContextVariableMap {
    apiKey: ApiKeyContext
  }
}
