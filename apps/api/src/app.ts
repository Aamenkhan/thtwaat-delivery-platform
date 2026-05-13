import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import { resolveCorsOrigin } from './lib/cors-origins.js'
import { authRouter } from './modules/auth/auth.routes.js'
import { orderRouter } from './modules/order/order.routes.js'
import { scanRouter } from './modules/scan/scan.routes.js'
import { otpRouter } from './modules/otp/otp.routes.js'
import { hubRouter } from './modules/hub/hub.routes.js'
import { pricingRouter } from './modules/pricing/pricing.routes.js'
import { workerRouter } from './modules/worker/worker.routes.js'
import { trackingRouter } from './modules/tracking/tracking.routes.js'
import { platformRouter } from './modules/platform/platform.routes.js'
import { publicApiRouter } from './modules/public-api/public.routes.js'
import { sellerRouter } from './modules/seller/seller.routes.js'
import { wooCommerceRouter } from './modules/woocommerce/woocommerce.routes.js'
import {
  shopifyOauthRouter,
  shopifyWebhookRouter,
} from './modules/shopify/shopify.routes.js'
import { errorHandler } from './middleware/error-handler.js'
import { prisma } from './lib/prisma.js'
import { domainEvents } from './lib/events.js'
import { registerOrderWebhookBridge } from './integrations/order-webhook-bridge.js'
import { registerEcommerceJobBridge } from './integrations/ecommerce-job-bridge.js'
import { registerWhatsAppBridge } from './integrations/whatsapp-bridge.js'
import { apiV1Router } from './routes/api-v1.routes.js'
import { adminLogisticsRouter } from './modules/admin-logistics/admin-logistics.routes.js'
import { adminShipmentsRouter } from './modules/admin-shipments/admin-shipments.routes.js'
import { adminOpsRouter } from './modules/admin-ops/admin-ops.routes.js'
import { adminStorageRouter } from './modules/admin-storage/admin-storage.routes.js'
import { paymentsSellerRouter } from './modules/payments/payments.routes.js'
import { razorpayWebhookRouter } from './modules/payments/razorpay.webhook.js'
import { pingRedis } from './lib/redis.js'

registerOrderWebhookBridge()
registerEcommerceJobBridge()
registerWhatsAppBridge()

export function createApp() {
  const app = express()
  // Behind Render / Railway / etc.: clients hit a reverse proxy; rate-limit uses X-Forwarded-For.
  if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1)
  }
  app.use(
    cors({
      origin: resolveCorsOrigin(),
      credentials: true,
    })
  )
  app.use(helmet())
  app.use(cookieParser())

  app.use(
    '/v1/integrations/shopify/webhooks',
    express.raw({ type: '*/*', limit: '2mb' }),
    shopifyWebhookRouter
  )

  app.use(
    '/v1/integrations/razorpay/webhook',
    express.raw({ type: 'application/json', limit: '2mb' }),
    razorpayWebhookRouter
  )

  app.use(express.json({ limit: '2mb' }))

  app.get('/health', async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`
      const redisOk = await pingRedis()
      res.json({
        status: 'ok',
        database: 'connected',
        redis: redisOk ? 'connected' : process.env.REDIS_URL ? 'error' : 'skipped',
        service: 'thtwaat-delivery-platform',
      })
    } catch {
      res.status(503).json({
        status: 'error',
        database: 'disconnected',
        redis: 'unknown',
        service: 'thtwaat-delivery-platform',
      })
    }
  })

  app.use('/v1/auth', authRouter)
  app.use('/v1/orders', orderRouter)
  app.use('/v1/scans', scanRouter)
  app.use('/v1/otp', otpRouter)
  app.use('/v1/admin/logistics', adminLogisticsRouter)
  app.use('/v1/admin/shipments', adminShipmentsRouter)
  app.use('/v1/admin/ops', adminOpsRouter)
  app.use('/v1/admin/storage', adminStorageRouter)
  app.use('/v1/hubs', hubRouter)
  app.use('/v1/pricing', pricingRouter)
  app.use('/v1/workers', workerRouter)
  app.use('/v1/tracking', trackingRouter)

  app.use('/v1/platform', platformRouter)
  app.use('/v1/public', publicApiRouter)
  app.use('/api/v1', apiV1Router)
  app.use('/v1/seller', sellerRouter)
  app.use('/v1/seller/payments', paymentsSellerRouter)
  app.use('/v1/integrations/woocommerce', wooCommerceRouter)
  app.use('/v1/integrations/shopify', shopifyOauthRouter)

  if (process.env.DEBUG_DOMAIN_EVENTS === '1') {
    domainEvents.on('order:status:changed', (p) => {
      console.log('[event] order:status:changed', p)
    })
  }

  app.use(errorHandler)
  return app
}
