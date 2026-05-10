import { Router, type Request, type Response, type NextFunction } from 'express'
import { requireAuth, requireRole } from '../../middleware/auth.js'
import { Role, StoreProvider } from '@prisma/client'
import { prisma } from '../../lib/prisma.js'
import { HttpError } from '../../lib/http-error.js'
import { requireSellerFromRequest } from '../../lib/seller-context.js'
import {
  exchangeShopifyToken,
  normalizeShopDomain,
  shopifyInstallUrl,
  signShopifyOAuthState,
  verifyShopifyOAuthState,
  verifyShopifyWebhook,
  upsertShopifyStore,
} from './shopify.service.js'
import { handleShopifyWebhookTopic } from './shopify.webhooks.js'

const oauthRouter = Router()

oauthRouter.get(
  '/install',
  requireAuth,
  requireRole(Role.SELLER, Role.HUB_MANAGER),
  async (req, res, next) => {
  try {
    const shopRaw = req.query.shop
    if (typeof shopRaw !== 'string' || !shopRaw.trim()) {
      throw new HttpError(400, 'shop query required')
    }
    const shop = normalizeShopDomain(shopRaw)
    const seller = await requireSellerFromRequest(req)
    const state = signShopifyOAuthState(seller.id)
    const url = shopifyInstallUrl(shop, state)
    res.redirect(302, url)
  } catch (e) {
    next(e)
  }
})

oauthRouter.get('/callback', async (req, res, next) => {
  try {
    const shopRaw = req.query.shop
    const code = req.query.code
    const state = req.query.state
    if (typeof shopRaw !== 'string' || typeof code !== 'string' || typeof state !== 'string') {
      throw new HttpError(400, 'Missing OAuth parameters')
    }
    const shop = normalizeShopDomain(shopRaw)
    const sellerId = verifyShopifyOAuthState(state)
    const accessToken = await exchangeShopifyToken(shop, code)
    await upsertShopifyStore({ sellerId, shop, accessToken })
    res
      .status(200)
      .send(
        '<p>Shopify connected. You can close this window and return to the dashboard.</p>'
      )
  } catch (e) {
    next(e)
  }
})

/** Raw body parser must run before this router (see app.ts). */
const webhookRouter = Router()

webhookRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const raw = req.body as Buffer
    if (!Buffer.isBuffer(raw)) {
      throw new HttpError(400, 'Expected raw body')
    }
    const hmac = req.get('X-Shopify-Hmac-Sha256')
    if (!verifyShopifyWebhook(raw, hmac)) {
      throw new HttpError(401, 'Invalid webhook signature')
    }
    const shop = req.get('X-Shopify-Shop-Domain')
    if (!shop) throw new HttpError(400, 'Missing shop domain header')
    const topic = req.get('X-Shopify-Topic')
    if (!topic) throw new HttpError(400, 'Missing topic')

    const store = await prisma.connectedStore.findFirst({
      where: {
        externalId: shop.toLowerCase(),
        provider: StoreProvider.SHOPIFY,
      },
    })
    if (!store) {
      res.status(202).json({ ok: true, ignored: true })
      return
    }

    await handleShopifyWebhookTopic(topic, store, raw.toString('utf8'))
    res.status(200).json({ ok: true })
  } catch (e) {
    next(e)
  }
})

export const shopifyOauthRouter = oauthRouter
export const shopifyWebhookRouter = webhookRouter
