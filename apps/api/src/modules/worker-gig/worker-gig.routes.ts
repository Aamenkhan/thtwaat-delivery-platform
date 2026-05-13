import { Router, type RequestHandler } from 'express'
import formidable from 'formidable'
import { readFile } from 'node:fs/promises'
import { z } from 'zod'
import { lookupIndiaPostalPincode } from '../../lib/india-postal-pincode.js'
import { HttpError } from '../../lib/http-error.js'
import { prisma } from '../../lib/prisma.js'
import { validateBody, validateQuery } from '../../middleware/validate.js'
import { requireWorkerJwt, requireSelfWorkerId } from './worker-gig.middleware.js'
import * as svc from './worker-gig.service.js'
import * as ord from './worker-gig-orders.service.js'
import { uploadWorkerAsset } from '../../lib/supabase-worker-storage.js'

const r = Router()

const registerBody = z.object({
  name: z.string().min(1),
  phone: z.string().min(10),
  role: z.string().min(1),
  hubId: z.string().min(1),
  address: z.string().optional(),
  city: z.string().optional(),
  pincode: z.string().optional(),
  vehicleNumber: z.string().optional(),
  vehicleType: z.string().optional(),
})

const verifyPhoneBody = z.object({
  workerId: z.string().min(1),
  otp: z.string().min(4).max(8),
})

const loginRequestBody = z.object({
  phone: z.string().min(10),
})

const loginVerifyBody = z.object({
  phone: z.string().min(10),
  otp: z.string().min(4).max(8),
})

const profilePutBody = z.object({
  name: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  pincode: z.string().optional(),
  vehicleNumber: z.string().optional(),
  vehicleType: z.string().optional(),
  upiId: z.string().optional(),
  aadhaarNumber: z.string().optional(),
  drivingLicenseNo: z.string().optional(),
  bankAccount: z.string().optional(),
  bankIfsc: z.string().optional(),
})

const statusBody = z.object({
  isOnline: z.boolean(),
  lat: z.number().optional(),
  lng: z.number().optional(),
})

const locBody = z.object({
  lat: z.number(),
  lng: z.number(),
})

const pickupScanBody = z.object({
  qrCode: z.string().min(1),
  photoUrl: z.string().min(1),
  lat: z.number(),
  lng: z.number(),
})

const otpBody = z.object({
  sessionId: z.string().min(1),
  otp: z.string().min(4).max(8),
})

const hubDropInitBody = z.object({
  hubId: z.string().min(1),
  lat: z.number(),
  lng: z.number(),
})

const hubDropVerifyBody = z.object({
  sessionId: z.string().min(1),
  otp: z.string().min(4).max(8),
  hubStaffId: z.string().min(1),
})

const deliveryInitBody = z.object({
  lat: z.number(),
  lng: z.number(),
})

const ok =
  (fn: (req: Parameters<RequestHandler>[0], res: Parameters<RequestHandler>[1]) => Promise<unknown>): RequestHandler =>
  async (req, res, next) => {
    try {
      const data = await fn(req, res)
      res.json({ ok: true, data })
    } catch (e) {
      next(e)
    }
  }

r.post('/workers/register', validateBody(registerBody), (req, res, next) => {
  void (async () => {
    try {
      const data = await svc.registerWorker(req.body)
      res.status(201).json({ ok: true, data })
    } catch (e) {
      next(e)
    }
  })()
})

r.post('/workers/verify-phone', validateBody(verifyPhoneBody), (req, res, next) => {
  void (async () => {
    try {
      const data = await svc.verifyWorkerPhone(req.body)
      res.json({ ok: true, data })
    } catch (e) {
      next(e)
    }
  })()
})

r.post('/workers/login/request-otp', validateBody(loginRequestBody), (req, res, next) => {
  void (async () => {
    try {
      const data = await svc.requestLoginOtp(req.body.phone)
      res.json({ ok: true, data })
    } catch (e) {
      next(e)
    }
  })()
})

r.post('/workers/login/verify', validateBody(loginVerifyBody), (req, res, next) => {
  void (async () => {
    try {
      const data = await svc.verifyLoginOtp(req.body)
      res.json({ ok: true, data })
    } catch (e) {
      next(e)
    }
  })()
})

r.get('/geo/pincode/:pin', (req, res, next) => {
  void (async () => {
    try {
      const pin = req.params.pin ?? ''
      const row = await lookupIndiaPostalPincode(pin)
      if (!row) throw new HttpError(404, 'Pincode not found')
      res.json({
        ok: true,
        data: { pincode: pin, city: row.city, state: row.state, area: row.area },
      })
    } catch (e) {
      next(e)
    }
  })()
})

r.get(
  '/workers/:id/profile',
  requireWorkerJwt,
  requireSelfWorkerId('id'),
  ok(async (req) => svc.getWorkerProfile(req.params.id!))
)

r.put(
  '/workers/:id/profile',
  requireWorkerJwt,
  requireSelfWorkerId('id'),
  validateBody(profilePutBody),
  ok(async (req) => svc.updateWorkerProfile(req.params.id!, req.body))
)

r.post(
  '/workers/:id/upload-photo',
  requireWorkerJwt,
  requireSelfWorkerId('id'),
  async (req, res, next) => {
    try {
      const form = formidable({
        maxFileSize: 8 * 1024 * 1024,
        allowEmptyFiles: false,
      })
      const [fields, files] = await form.parse(req)
      const raw = files.file
      const file = Array.isArray(raw) ? raw[0] : raw
      if (!file) throw new HttpError(400, 'Missing file field (use field name "file")')

      const type = String(fields.type?.[0] ?? '')
        .toLowerCase()
        .trim()
      if (type !== 'profile' && type !== 'aadhaar' && type !== 'license') {
        throw new HttpError(400, 'form field type must be profile | aadhaar | license')
      }

      const filepath = (file as { filepath: string }).filepath
      const buf = await readFile(filepath)
      const ct =
        (file as { mimetype?: string | null }).mimetype || 'application/octet-stream'
      const photoUrl = await uploadWorkerAsset({
        workerId: req.params.id!,
        type,
        filename:
          (file as { originalFilename?: string | null }).originalFilename ||
          'upload.jpg',
        buffer: buf,
        contentType: ct,
      })
      const update =
        type === 'profile'
          ? { photoUrl }
          : type === 'aadhaar'
            ? { aadhaarPhotoUrl: photoUrl }
            : { drivingLicenseUrl: photoUrl }
      await prisma.worker.update({ where: { id: req.params.id! }, data: update })
      res.json({ ok: true, data: { photoUrl } })
    } catch (e) {
      next(e)
    }
  }
)

r.patch(
  '/workers/:id/status',
  requireWorkerJwt,
  requireSelfWorkerId('id'),
  validateBody(statusBody),
  ok(async (req) => {
    const w = await svc.setWorkerOnlineStatus({
      workerId: req.params.id!,
      isOnline: req.body.isOnline,
      lat: req.body.lat,
      lng: req.body.lng,
    })
    return {
      isOnline: w.isOnline,
      message: w.isOnline ? 'You are online' : 'You are offline',
    }
  })
)

r.post(
  '/workers/:id/location',
  requireWorkerJwt,
  requireSelfWorkerId('id'),
  validateBody(locBody),
  ok(async (req) => svc.recordWorkerLocation({ workerId: req.params.id!, ...req.body }))
)

const ordersQuery = z.object({
  filter: z.enum(['active', 'completed_today']).optional(),
})

r.get(
  '/workers/me/orders',
  requireWorkerJwt,
  validateQuery(ordersQuery),
  ok(async (req) => {
    const mode =
      (req.query as { filter?: string }).filter === 'completed_today'
        ? 'completed_today'
        : 'active'
    return svc.listWorkerOrders(req.workerAuth!.workerId, mode)
  })
)

r.get(
  '/orders/:orderId',
  requireWorkerJwt,
  ok(async (req) =>
    ord.getOrderDetail(req.params.orderId!, req.workerAuth!.workerId)
  )
)

r.post(
  '/orders/:orderId/pickup/init',
  requireWorkerJwt,
  ok(async (req) =>
    ord.pickupInit(req.params.orderId!, req.workerAuth!.workerId)
  )
)

r.post(
  '/orders/:orderId/pickup/scan',
  requireWorkerJwt,
  validateBody(pickupScanBody),
  ok(async (req) =>
    ord.pickupScan({
      orderId: req.params.orderId!,
      workerId: req.workerAuth!.workerId,
      ...req.body,
    })
  )
)

r.post(
  '/orders/:orderId/pickup/verify-otp',
  requireWorkerJwt,
  validateBody(otpBody),
  ok(async (req) =>
    ord.pickupVerifyOtp({
      orderId: req.params.orderId!,
      workerId: req.workerAuth!.workerId,
      ...req.body,
    })
  )
)

r.post(
  '/orders/:orderId/hub-drop/init',
  requireWorkerJwt,
  validateBody(hubDropInitBody),
  ok(async (req) =>
    ord.hubDropInit({
      orderId: req.params.orderId!,
      workerId: req.workerAuth!.workerId,
      ...req.body,
    })
  )
)

r.post(
  '/orders/:orderId/hub-drop/verify-otp',
  requireWorkerJwt,
  validateBody(hubDropVerifyBody),
  ok(async (req) =>
    ord.hubDropVerifyOtp({
      orderId: req.params.orderId!,
      workerId: req.workerAuth!.workerId,
      ...req.body,
    })
  )
)

r.post(
  '/orders/:orderId/delivery/init',
  requireWorkerJwt,
  validateBody(deliveryInitBody),
  ok(async (req) =>
    ord.deliveryInit({
      orderId: req.params.orderId!,
      workerId: req.workerAuth!.workerId,
      ...req.body,
    })
  )
)

r.post(
  '/orders/:orderId/delivery/scan',
  requireWorkerJwt,
  validateBody(pickupScanBody),
  ok(async (req) =>
    ord.deliveryScan({
      orderId: req.params.orderId!,
      workerId: req.workerAuth!.workerId,
      ...req.body,
    })
  )
)

r.post(
  '/orders/:orderId/delivery/verify-otp',
  requireWorkerJwt,
  validateBody(otpBody),
  ok(async (req) =>
    ord.deliveryVerifyOtp({
      orderId: req.params.orderId!,
      workerId: req.workerAuth!.workerId,
      ...req.body,
    })
  )
)

export const workerGigRouter = r
