import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { prisma } from './lib/db.js'
import { jsonError, jsonOk } from './lib/http.js'
import './types/hono.js'
import { hubRoutes } from './modules/hub-service/routes.js'
import { notifyAdminRoutes } from './modules/notify-service/admin-routes.js'
import { notifyRoutes } from './modules/notify-service/routes.js'
import { orderRoutes } from './modules/order-service/routes.js'
import { otpRoutes } from './modules/otp-service/routes.js'
import { payoutRoutes } from './modules/payout-service/routes.js'
import { pricingRoutes } from './modules/pricing-service/routes.js'
import { scanRoutes } from './modules/scan-service/routes.js'
import { workerRoutes } from './modules/worker-service/routes.js'

function parseOrigins(): string[] | '*' {
  const raw = process.env.CORS_ORIGIN
  if (!raw) return '*'
  return raw.split(',').map((s) => s.trim()).filter(Boolean)
}

export function createApp() {
  const app = new Hono()
  const origins = parseOrigins()

  app.use(
    '*',
    cors({
      origin: (origin) => {
        if (origins === '*') return '*'
        if (!origin) return '*'
        return origins.includes(origin) ? origin : origins[0] ?? '*'
      },
    })
  )

  app.get('/health', (c) =>
    c.json({ ok: true as const, service: 'logistics-api' })
  )

  app.get('/v1/public/orders/:publicId', async (c) => {
    const publicId = c.req.param('publicId')
    const order = await prisma.order.findUnique({
      where: { publicId },
      select: {
        publicId: true,
        status: true,
        destinationLat: true,
        destinationLng: true,
        hubId: true,
        returnInitiated: true,
        photoProofUrls: true,
        createdAt: true,
        updatedAt: true,
      },
    })
    if (!order) {
      return jsonError(c, 'not_found', 'Order not found', 404)
    }
    return jsonOk(c, { order })
  })

  app.route('/v1/orders', orderRoutes)
  app.route('/v1/scans', scanRoutes)
  app.route('/v1/hubs', hubRoutes)
  app.route('/v1/otp', otpRoutes)
  app.route('/v1/payouts', payoutRoutes)
  app.route('/v1/pricing', pricingRoutes)
  app.route('/v1/workers', workerRoutes)
  app.route('/v1/notify', notifyRoutes)
  app.route('/v1/platform', notifyAdminRoutes)

  return app
}
