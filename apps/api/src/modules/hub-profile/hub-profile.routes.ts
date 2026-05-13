import { Router } from 'express'
import { z } from 'zod'
import { PartnerTruckBookingStatus, HubGigRole } from '@prisma/client'
import { validateBody, validateQuery } from '../../middleware/validate.js'
import { HttpError } from '../../lib/http-error.js'
import * as svc from './hub-profile.service.js'

const r = Router({ mergeParams: true })

const hubIdParam = z.object({
  hubId: z.string().min(1),
})

function hubIdFromReq(req: { params: Record<string, string | undefined> }) {
  const p = hubIdParam.safeParse(req.params)
  if (!p.success) throw new HttpError(400, 'Invalid hub id')
  return p.data.hubId
}

const profilePutSchema = z.object({
  photoUrl: z.union([z.string().url(), z.null()]).optional(),
  description: z.string().max(2000).nullable().optional(),
  managerName: z.string().min(1).max(120),
  managerPhone: z.string().min(5).max(20),
  address: z.string().min(1).max(500),
  city: z.string().min(1).max(120),
  state: z.string().min(1).max(120),
  pincode: z.string().min(3).max(12),
  isActive: z.boolean().optional(),
})

const gigPost = z
  .object({
    workerId: z.string().min(1).optional(),
    displayName: z.string().min(1).max(120).optional(),
    phone: z.string().min(5).max(20).optional(),
    gigRole: z.nativeEnum(HubGigRole),
  })
  .refine((b) => b.workerId || (b.displayName && b.phone), {
    message: 'Either workerId or both displayName and phone is required',
  })

const busPost = z.object({
  driverName: z.string().min(1),
  driverPhone: z.string().min(5),
  busNumber: z.string().min(1),
  busType: z.string().min(1),
  routeFrom: z.string().min(1),
  routeTo: z.string().min(1),
  departureTimes: z.array(z.string().min(1)).min(1),
  pricePerParcel: z.number().positive().optional(),
  maxParcels: z.number().int().positive().max(5000).optional(),
  photoUrl: z.union([z.string().url(), z.null()]).optional(),
  isActive: z.boolean().optional(),
})

const busPut = busPost.partial()

const transportPost = z.object({
  ownerName: z.string().min(1),
  ownerPhone: z.string().min(5),
  ownerPhone2: z.string().min(5).nullable().optional(),
  address: z.string().min(1),
  city: z.string().min(1),
  photoUrl: z.union([z.string().url(), z.null()]).optional(),
  isVerified: z.boolean().optional(),
  trucks: z
    .array(
      z.object({
        truckNumber: z.string().min(1),
        truckType: z.string().min(1),
        capacityTons: z.number().positive(),
        photoUrl: z.union([z.string().url(), z.null()]).optional(),
        ownershipType: z.enum(['OWN', 'COMMISSION']),
        commissionPercent: z.number().positive().max(100).nullable().optional(),
      })
    )
    .optional(),
})

const transportPut = z.object({
  ownerName: z.string().min(1).optional(),
  ownerPhone: z.string().min(5).optional(),
  ownerPhone2: z.string().min(5).nullable().optional(),
  address: z.string().min(1).optional(),
  city: z.string().min(1).optional(),
  photoUrl: z.union([z.string().url(), z.null()]).optional(),
  isVerified: z.boolean().optional(),
  isActive: z.boolean().optional(),
})

const truckPost = z.object({
  truckNumber: z.string().min(1),
  truckType: z.string().min(1),
  capacityTons: z.number().positive(),
  photoUrl: z.union([z.string().url(), z.null()]).optional(),
  ownershipType: z.enum(['OWN', 'COMMISSION']),
  commissionPercent: z.number().positive().max(100).nullable().optional(),
})

const truckPut = truckPost.partial()

const bookingPost = z.object({
  truckId: z.string().min(1),
  customerName: z.string().min(1),
  customerPhone: z.string().min(5),
  pickupAddress: z.string().min(1),
  deliveryAddress: z.string().min(1),
  goodsType: z.string().min(1),
  weightTons: z.number().positive(),
  agreedPrice: z.number().positive(),
  scheduledDate: z.string().min(4),
  notes: z.string().max(2000).nullable().optional(),
})

const bookingStatusPatch = z.object({
  status: z.nativeEnum(PartnerTruckBookingStatus),
})

const parcelQuery = z.object({
  search: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
})

r.get('/profile', async (req, res, next) => {
  try {
    const hubId = hubIdFromReq(req)
    const data = await svc.getProfile(hubId)
    res.json({ ok: true, data })
  } catch (e) {
    next(e)
  }
})

r.put('/profile', validateBody(profilePutSchema), async (req, res, next) => {
  try {
    const hubId = hubIdFromReq(req)
    const profile = await svc.upsertProfile(hubId, req.body)
    res.json({ ok: true, data: { profile } })
  } catch (e) {
    next(e)
  }
})

r.get('/parcels/pending', validateQuery(parcelQuery), async (req, res, next) => {
  try {
    const hubId = hubIdFromReq(req)
    const q = req.query as z.infer<typeof parcelQuery>
    const orders = await svc.listPendingParcels(hubId, { search: q.search })
    res.json({ ok: true, data: { orders } })
  } catch (e) {
    next(e)
  }
})

r.get('/parcels/delivered', validateQuery(parcelQuery), async (req, res, next) => {
  try {
    const hubId = hubIdFromReq(req)
    const q = req.query as z.infer<typeof parcelQuery>
    const orders = await svc.listDeliveredParcels(hubId, {
      search: q.search,
      from: q.from ? new Date(q.from) : undefined,
      to: q.to ? new Date(q.to) : undefined,
    })
    res.json({ ok: true, data: { orders } })
  } catch (e) {
    next(e)
  }
})

r.get('/parcels/stats', async (req, res, next) => {
  try {
    const hubId = hubIdFromReq(req)
    const stats = await svc.parcelStats(hubId)
    res.json({ ok: true, data: { stats } })
  } catch (e) {
    next(e)
  }
})

r.get('/gig-workers', async (req, res, next) => {
  try {
    const hubId = hubIdFromReq(req)
    const assignments = await svc.listGigWorkers(hubId)
    res.json({ ok: true, data: { assignments } })
  } catch (e) {
    next(e)
  }
})

r.post('/gig-workers', validateBody(gigPost), async (req, res, next) => {
  try {
    const hubId = hubIdFromReq(req)
    const assignment = await svc.addGigWorker(hubId, req.body)
    res.status(201).json({ ok: true, data: { assignment } })
  } catch (e) {
    next(e)
  }
})

r.delete('/gig-workers/:workerId', async (req, res, next) => {
  try {
    const hubId = hubIdFromReq(req)
    const workerId = req.params.workerId!
    const data = await svc.removeGigWorker(hubId, workerId)
    res.json({ ok: true, data })
  } catch (e) {
    next(e)
  }
})

r.get('/bus-services', async (req, res, next) => {
  try {
    const hubId = hubIdFromReq(req)
    const busServices = await svc.listBusServices(hubId)
    res.json({ ok: true, data: { busServices } })
  } catch (e) {
    next(e)
  }
})

r.post('/bus-services', validateBody(busPost), async (req, res, next) => {
  try {
    const hubId = hubIdFromReq(req)
    const bus = await svc.createBusService(hubId, req.body)
    res.status(201).json({ ok: true, data: { bus } })
  } catch (e) {
    next(e)
  }
})

r.put('/bus-services/:id', validateBody(busPut), async (req, res, next) => {
  try {
    const hubId = hubIdFromReq(req)
    const bus = await svc.updateBusService(hubId, req.params.id!, req.body)
    res.json({ ok: true, data: { bus } })
  } catch (e) {
    next(e)
  }
})

r.delete('/bus-services/:id', async (req, res, next) => {
  try {
    const hubId = hubIdFromReq(req)
    const data = await svc.deleteBusService(hubId, req.params.id!)
    res.json({ ok: true, data })
  } catch (e) {
    next(e)
  }
})

r.patch('/bus-services/:id/toggle', async (req, res, next) => {
  try {
    const hubId = hubIdFromReq(req)
    const bus = await svc.toggleBusService(hubId, req.params.id!)
    res.json({ ok: true, data: { bus } })
  } catch (e) {
    next(e)
  }
})

r.get('/transport-partners', async (req, res, next) => {
  try {
    const hubId = hubIdFromReq(req)
    const transportPartners = await svc.listTransportPartners(hubId)
    res.json({ ok: true, data: { transportPartners } })
  } catch (e) {
    next(e)
  }
})

r.post('/transport-partners', validateBody(transportPost), async (req, res, next) => {
  try {
    const hubId = hubIdFromReq(req)
    const body = req.body as z.infer<typeof transportPost>
    const { trucks, ...rest } = body
    const partner = await svc.createTransportPartner(hubId, {
      ...rest,
      trucks: trucks?.map((t) => ({
        ...t,
        ownershipType: t.ownershipType,
      })),
    })
    res.status(201).json({ ok: true, data: { partner } })
  } catch (e) {
    next(e)
  }
})

r.put('/transport-partners/:partnerId', validateBody(transportPut), async (req, res, next) => {
  try {
    const hubId = hubIdFromReq(req)
    const partner = await svc.updateTransportPartner(hubId, req.params.partnerId!, req.body)
    res.json({ ok: true, data: { partner } })
  } catch (e) {
    next(e)
  }
})

r.delete('/transport-partners/:partnerId', async (req, res, next) => {
  try {
    const hubId = hubIdFromReq(req)
    const data = await svc.deleteTransportPartner(hubId, req.params.partnerId!)
    res.json({ ok: true, data })
  } catch (e) {
    next(e)
  }
})

r.get('/transport-partners/:partnerId/trucks', async (req, res, next) => {
  try {
    const hubId = hubIdFromReq(req)
    const trucks = await svc.listTrucks(hubId, req.params.partnerId!)
    res.json({ ok: true, data: { trucks } })
  } catch (e) {
    next(e)
  }
})

r.post('/transport-partners/:partnerId/trucks', validateBody(truckPost), async (req, res, next) => {
  try {
    const hubId = hubIdFromReq(req)
    const truck = await svc.createTruck(hubId, req.params.partnerId!, req.body)
    res.status(201).json({ ok: true, data: { truck } })
  } catch (e) {
    next(e)
  }
})

r.put(
  '/transport-partners/:partnerId/trucks/:truckId',
  validateBody(truckPut),
  async (req, res, next) => {
    try {
      const hubId = hubIdFromReq(req)
      const truck = await svc.updateTruck(
        hubId,
        req.params.partnerId!,
        req.params.truckId!,
        req.body
      )
      res.json({ ok: true, data: { truck } })
    } catch (e) {
      next(e)
    }
  }
)

r.patch(
  '/transport-partners/:partnerId/trucks/:truckId/toggle',
  async (req, res, next) => {
    try {
      const hubId = hubIdFromReq(req)
      const truck = await svc.toggleTruck(hubId, req.params.partnerId!, req.params.truckId!)
      res.json({ ok: true, data: { truck } })
    } catch (e) {
      next(e)
    }
  }
)

r.get('/truck-bookings', async (req, res, next) => {
  try {
    const hubId = hubIdFromReq(req)
    const bookings = await svc.listPartnerTruckBookings(hubId)
    res.json({ ok: true, data: { bookings } })
  } catch (e) {
    next(e)
  }
})

r.post('/truck-bookings', validateBody(bookingPost), async (req, res, next) => {
  try {
    const hubId = hubIdFromReq(req)
    const b = req.body as z.infer<typeof bookingPost>
    const booking = await svc.createPartnerTruckBooking(hubId, {
      ...b,
      scheduledDate: new Date(b.scheduledDate),
    })
    res.status(201).json({ ok: true, data: { booking } })
  } catch (e) {
    next(e)
  }
})

r.patch(
  '/truck-bookings/:id/status',
  validateBody(bookingStatusPatch),
  async (req, res, next) => {
    try {
      const hubId = hubIdFromReq(req)
      const booking = await svc.patchPartnerTruckBookingStatus(
        hubId,
        req.params.id!,
        req.body.status
      )
      res.json({ ok: true, data: { booking } })
    } catch (e) {
      next(e)
    }
  }
)

export const hubProfileRouter = r
