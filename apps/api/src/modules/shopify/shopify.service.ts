import { createHmac, timingSafeEqual } from 'node:crypto'
import jwt from 'jsonwebtoken'
import { StoreProvider } from '@prisma/client'
import { prisma } from '../../lib/prisma.js'
import { HttpError } from '../../lib/http-error.js'

function jwtSecret() {
  const s = process.env.JWT_SECRET
  if (!s) throw new Error('JWT_SECRET is not set')
  return s
}

export function verifyShopifyWebhook(
  rawBody: Buffer,
  hmacHeader: string | undefined
): boolean {
  const secret = process.env.SHOPIFY_API_SECRET
  if (!secret || !hmacHeader) return false
  const digest = createHmac('sha256', secret).update(rawBody).digest('base64')
  try {
    const a = Buffer.from(digest, 'utf8')
    const b = Buffer.from(hmacHeader, 'utf8')
    return a.length === b.length && timingSafeEqual(a, b)
  } catch {
    return false
  }
}

export function signShopifyOAuthState(sellerId: string): string {
  return jwt.sign(
    { t: 'shopify_oauth', sellerId },
    jwtSecret(),
    { expiresIn: '15m' }
  )
}

export function verifyShopifyOAuthState(token: string): string {
  try {
    const d = jwt.verify(token, jwtSecret()) as { t?: string; sellerId?: string }
    if (d.t !== 'shopify_oauth' || typeof d.sellerId !== 'string') {
      throw new HttpError(400, 'Invalid OAuth state')
    }
    return d.sellerId
  } catch (e) {
    if (e instanceof HttpError) throw e
    throw new HttpError(400, 'Invalid OAuth state')
  }
}

export function normalizeShopDomain(shop: string): string {
  const s = shop.trim().toLowerCase().replace(/^https?:\/\//, '')
  if (!s.endsWith('.myshopify.com') || s.includes('..')) {
    throw new HttpError(400, 'Invalid shop domain')
  }
  return s
}

export function shopifyInstallUrl(shop: string, state: string): string {
  const clientId = process.env.SHOPIFY_API_KEY
  const redirect = process.env.SHOPIFY_REDIRECT_URI
  if (!clientId || !redirect) {
    throw new HttpError(500, 'Shopify app env not configured')
  }
  const scope =
    process.env.SHOPIFY_SCOPES ??
    'read_orders,write_orders,read_fulfillments,write_fulfillments'
  const q = new URLSearchParams({
    client_id: clientId,
    scope,
    state,
    redirect_uri: redirect,
  })
  return `https://${shop}/admin/oauth/authorize?${q.toString()}`
}

export async function exchangeShopifyToken(shop: string, code: string) {
  const clientId = process.env.SHOPIFY_API_KEY
  const clientSecret = process.env.SHOPIFY_API_SECRET
  if (!clientId || !clientSecret) {
    throw new HttpError(500, 'Shopify app env not configured')
  }
  const res = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new HttpError(502, `Shopify token exchange failed: ${text}`)
  }
  const body = (await res.json()) as { access_token?: string; scope?: string }
  if (!body.access_token) throw new HttpError(502, 'No access_token from Shopify')
  return body.access_token
}

export async function upsertShopifyStore(args: {
  sellerId: string
  shop: string
  accessToken: string
}) {
  return prisma.connectedStore.upsert({
    where: {
      sellerId_provider_externalId: {
        sellerId: args.sellerId,
        provider: StoreProvider.SHOPIFY,
        externalId: args.shop,
      },
    },
    create: {
      sellerId: args.sellerId,
      provider: StoreProvider.SHOPIFY,
      externalId: args.shop,
      displayName: args.shop,
      accessToken: args.accessToken,
      lastSyncStatus: 'CONNECTED',
    },
    update: {
      accessToken: args.accessToken,
      lastSyncStatus: 'CONNECTED',
      status: 'ACTIVE',
    },
  })
}
