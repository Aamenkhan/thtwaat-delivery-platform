import { StoreProvider } from '@prisma/client'
import { prisma } from '../../lib/prisma.js'
import { HttpError } from '../../lib/http-error.js'

export function normalizeWooBaseUrl(input: string): string {
  const u = new URL(input.trim())
  if (u.protocol !== 'https:' && u.protocol !== 'http:') {
    throw new HttpError(400, 'Invalid site URL')
  }
  u.pathname = ''
  u.search = ''
  u.hash = ''
  return u.toString().replace(/\/$/, '')
}

export async function upsertWooStore(args: {
  sellerId: string
  siteUrl: string
  consumerKey: string
  consumerSecret: string
}) {
  const externalId = normalizeWooBaseUrl(args.siteUrl)
  return prisma.connectedStore.upsert({
    where: {
      sellerId_provider_externalId: {
        sellerId: args.sellerId,
        provider: StoreProvider.WOOCOMMERCE,
        externalId,
      },
    },
    create: {
      sellerId: args.sellerId,
      provider: StoreProvider.WOOCOMMERCE,
      externalId,
      displayName: externalId,
      credentialsJson: {
        consumerKey: args.consumerKey,
        consumerSecret: args.consumerSecret,
      },
      lastSyncStatus: 'CONNECTED',
    },
    update: {
      credentialsJson: {
        consumerKey: args.consumerKey,
        consumerSecret: args.consumerSecret,
      },
      lastSyncStatus: 'CONNECTED',
      status: 'ACTIVE',
    },
  })
}

export async function wooFetchJson(
  storeId: string,
  path: string,
  query: Record<string, string> = {}
) {
  const store = await prisma.connectedStore.findUnique({
    where: { id: storeId },
  })
  if (!store || store.provider !== StoreProvider.WOOCOMMERCE) {
    throw new HttpError(404, 'WooCommerce store not found')
  }
  const creds = store.credentialsJson as {
    consumerKey?: string
    consumerSecret?: string
  } | null
  if (!creds?.consumerKey || !creds?.consumerSecret) {
    throw new HttpError(400, 'Store credentials missing')
  }
  const base = store.externalId.replace(/\/$/, '')
  const url = new URL(`${base}/wp-json/wc/v3/${path.replace(/^\//, '')}`)
  for (const [k, v] of Object.entries(query)) {
    url.searchParams.set(k, v)
  }
  url.username = creds.consumerKey
  url.password = creds.consumerSecret
  const res = await fetch(url.toString())
  if (!res.ok) {
    const text = await res.text()
    throw new HttpError(502, `WooCommerce API ${res.status}: ${text}`)
  }
  return res.json() as Promise<unknown>
}
