import { randomBytes } from 'node:crypto'
import bcrypt from 'bcryptjs'
import {
  PrismaClient,
  OrderType,
  HubType,
  TransportMode,
  DeliveryZoneClass,
  Role,
  MembershipRole,
  WorkerRole,
} from '@prisma/client'

const prisma = new PrismaClient()

/**
 * Optional: set DEMO_SEED_EMAIL + DEMO_SEED_PASSWORD when running seed on a
 * fresh production DB so you can log in (e.g. seller portal on Vercel).
 * Password is bcrypt-hashed the same way as the API register flow.
 */
async function seedDemoAuthFromEnv() {
  const email = process.env.DEMO_SEED_EMAIL?.trim().toLowerCase()
  const password = process.env.DEMO_SEED_PASSWORD
  if (!email || !password) return

  const companyName =
    process.env.DEMO_SEED_COMPANY?.trim() ||
    email.split('@')[0] ||
    'Demo seller'
  const slugBase =
    companyName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'demo-workspace'
  const slug = `${slugBase}-${randomBytes(3).toString('hex')}`.slice(0, 64)

  const hash = await bcrypt.hash(password, 12)
  const existing = await prisma.user.findFirst({ where: { email } })
  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: { passwordHash: hash },
    })
    console.log('DEMO_SEED: updated password for existing user', email)
    return
  }

  await prisma.$transaction(async (tx) => {
    const u = await tx.user.create({
      data: {
        email,
        passwordHash: hash,
        role: Role.SELLER,
      },
    })
    const org = await tx.organization.create({
      data: {
        name: companyName.slice(0, 120),
        slug,
      },
    })
    await tx.organizationMember.create({
      data: {
        organizationId: org.id,
        userId: u.id,
        role: MembershipRole.SELLER,
      },
    })
    const seller = await tx.seller.create({
      data: {
        userId: u.id,
        companyName: companyName.slice(0, 120),
        organizationId: org.id,
      },
    })
    await tx.wallet.create({
      data: { sellerId: seller.id, balanceCents: 0, currency: 'INR' },
    })
  })

  console.log('DEMO_SEED: created seller user', email)
}

/**
 * Optional production field worker (Vercel worker-web + Render API).
 * Set WORKER_SEED_EMAIL + WORKER_SEED_PASSWORD when running seed against production.
 * Password is bcrypt-hashed with cost 12 (same as API register).
 *
 * Hub: WORKER_SEED_HUB_CODE (default BLR_CC = "Bangalore City Hub" from seed data).
 */
async function seedProductionWorkerFromEnv() {
  const email = process.env.WORKER_SEED_EMAIL?.trim().toLowerCase()
  const password = process.env.WORKER_SEED_PASSWORD
  if (!email || !password) return

  const hubCode = process.env.WORKER_SEED_HUB_CODE?.trim() || 'BLR_CC'
  const displayName =
    process.env.WORKER_SEED_DISPLAY_NAME?.trim() || 'Bangalore field worker'
  const phone = process.env.WORKER_SEED_PHONE?.trim() || null

  const hub = await prisma.hub.findFirst({ where: { code: hubCode } })
  if (!hub) {
    console.warn(
      'WORKER_SEED: no hub with code',
      hubCode,
      '— run full hub seed first; skipping worker seed'
    )
    return
  }

  const hash = await bcrypt.hash(password, 12)

  const existing = await prisma.user.findFirst({ where: { email } })
  if (existing) {
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: existing.id },
        data: { passwordHash: hash, role: Role.WORKER },
      })
      const w = await tx.worker.findUnique({ where: { userId: existing.id } })
      if (w) {
        await tx.worker.update({
          where: { id: w.id },
          data: {
            displayName,
            phone: phone ?? undefined,
            isActive: true,
            homeHubId: hub.id,
            role: WorkerRole.COURIER,
          },
        })
      } else {
        await tx.worker.create({
          data: {
            userId: existing.id,
            displayName,
            phone,
            isActive: true,
            homeHubId: hub.id,
            role: WorkerRole.COURIER,
          },
        })
      }
    })
    console.log('WORKER_SEED: updated', email, '→ hub', hub.code, hub.name)
    return
  }

  await prisma.$transaction(async (tx) => {
    const u = await tx.user.create({
      data: {
        email,
        passwordHash: hash,
        role: Role.WORKER,
      },
    })
    await tx.worker.create({
      data: {
        userId: u.id,
        displayName,
        phone,
        isActive: true,
        homeHubId: hub.id,
        role: WorkerRole.COURIER,
      },
    })
  })

  console.log('WORKER_SEED: created', email, '→ hub', hub.code, hub.name)
}

type HubSeed = {
  code: string
  name: string
  city: string
  state: string
  hubType: HubType
  parentCode: string | null
  lat: number
  lng: number
  pincodeRanges?: { from: string; to: string }[]
}

/** Tier-1 national sort + state trunk + city last-mile + sample delivery center. */
const HUBS: HubSeed[] = [
  {
    code: 'DEL_NHD',
    name: 'National Sort — Delhi',
    city: 'New Delhi',
    state: 'Delhi',
    hubType: HubType.NATIONAL,
    parentCode: null,
    lat: 28.6139,
    lng: 77.209,
    pincodeRanges: [{ from: '110001', to: '110099' }],
  },
  {
    code: 'MH_STATE',
    name: 'Maharashtra State Hub',
    city: 'Mumbai',
    state: 'Maharashtra',
    hubType: HubType.STATE,
    parentCode: 'DEL_NHD',
    lat: 19.076,
    lng: 72.8777,
  },
  {
    code: 'MP_STATE',
    name: 'Madhya Pradesh State Hub',
    city: 'Bhopal',
    state: 'Madhya Pradesh',
    hubType: HubType.STATE,
    parentCode: 'DEL_NHD',
    lat: 23.2599,
    lng: 77.4126,
  },
  {
    code: 'KA_STATE',
    name: 'Karnataka State Hub',
    city: 'Bengaluru',
    state: 'Karnataka',
    hubType: HubType.STATE,
    parentCode: 'DEL_NHD',
    lat: 12.9716,
    lng: 77.5946,
  },
  {
    code: 'TS_STATE',
    name: 'Telangana State Hub',
    city: 'Hyderabad',
    state: 'Telangana',
    hubType: HubType.STATE,
    parentCode: 'DEL_NHD',
    lat: 17.385,
    lng: 78.4867,
  },
  {
    code: 'TN_STATE',
    name: 'Tamil Nadu State Hub',
    city: 'Chennai',
    state: 'Tamil Nadu',
    hubType: HubType.STATE,
    parentCode: 'DEL_NHD',
    lat: 13.0827,
    lng: 80.2707,
  },
  {
    code: 'WB_STATE',
    name: 'West Bengal State Hub',
    city: 'Kolkata',
    state: 'West Bengal',
    hubType: HubType.STATE,
    parentCode: 'DEL_NHD',
    lat: 22.5726,
    lng: 88.3639,
  },
  {
    code: 'GJ_STATE',
    name: 'Gujarat State Hub',
    city: 'Ahmedabad',
    state: 'Gujarat',
    hubType: HubType.STATE,
    parentCode: 'DEL_NHD',
    lat: 23.0225,
    lng: 72.5714,
  },
  {
    code: 'RJ_STATE',
    name: 'Rajasthan State Hub',
    city: 'Jaipur',
    state: 'Rajasthan',
    hubType: HubType.STATE,
    parentCode: 'DEL_NHD',
    lat: 26.9124,
    lng: 75.7873,
  },
  {
    code: 'UP_STATE',
    name: 'Uttar Pradesh State Hub',
    city: 'Lucknow',
    state: 'Uttar Pradesh',
    hubType: HubType.STATE,
    parentCode: 'DEL_NHD',
    lat: 26.8467,
    lng: 80.9462,
  },
  {
    code: 'CH_UT',
    name: 'Chandigarh UT Hub',
    city: 'Chandigarh',
    state: 'Chandigarh',
    hubType: HubType.STATE,
    parentCode: 'DEL_NHD',
    lat: 30.7333,
    lng: 76.7794,
  },
  {
    code: 'MUM_CC',
    name: 'Mumbai City Hub',
    city: 'Mumbai',
    state: 'Maharashtra',
    hubType: HubType.CITY,
    parentCode: 'MH_STATE',
    lat: 19.076,
    lng: 72.8777,
    pincodeRanges: [{ from: '400001', to: '400104' }],
  },
  {
    code: 'PNQ_CC',
    name: 'Pune City Hub',
    city: 'Pune',
    state: 'Maharashtra',
    hubType: HubType.CITY,
    parentCode: 'MH_STATE',
    lat: 18.5204,
    lng: 73.8567,
    pincodeRanges: [{ from: '411001', to: '411099' }],
  },
  {
    code: 'BLR_CC',
    name: 'Bangalore City Hub',
    city: 'Bengaluru',
    state: 'Karnataka',
    hubType: HubType.CITY,
    parentCode: 'KA_STATE',
    lat: 12.9716,
    lng: 77.5946,
    pincodeRanges: [{ from: '560001', to: '560110' }],
  },
  {
    code: 'HYD_CC',
    name: 'Hyderabad City Hub',
    city: 'Hyderabad',
    state: 'Telangana',
    hubType: HubType.CITY,
    parentCode: 'TS_STATE',
    lat: 17.385,
    lng: 78.4867,
    pincodeRanges: [{ from: '500001', to: '500099' }],
  },
  {
    code: 'CHN_CC',
    name: 'Chennai City Hub',
    city: 'Chennai',
    state: 'Tamil Nadu',
    hubType: HubType.CITY,
    parentCode: 'TN_STATE',
    lat: 13.0827,
    lng: 80.2707,
    pincodeRanges: [{ from: '600001', to: '600099' }],
  },
  {
    code: 'KOL_CC',
    name: 'Kolkata City Hub',
    city: 'Kolkata',
    state: 'West Bengal',
    hubType: HubType.CITY,
    parentCode: 'WB_STATE',
    lat: 22.5726,
    lng: 88.3639,
    pincodeRanges: [{ from: '700001', to: '700099' }],
  },
  {
    code: 'AMD_CC',
    name: 'Ahmedabad City Hub',
    city: 'Ahmedabad',
    state: 'Gujarat',
    hubType: HubType.CITY,
    parentCode: 'GJ_STATE',
    lat: 23.0225,
    lng: 72.5714,
    pincodeRanges: [{ from: '380001', to: '380099' }],
  },
  {
    code: 'JAI_CC',
    name: 'Jaipur City Hub',
    city: 'Jaipur',
    state: 'Rajasthan',
    hubType: HubType.CITY,
    parentCode: 'RJ_STATE',
    lat: 26.9124,
    lng: 75.7873,
    pincodeRanges: [{ from: '302001', to: '302099' }],
  },
  {
    code: 'LKO_CC',
    name: 'Lucknow City Hub',
    city: 'Lucknow',
    state: 'Uttar Pradesh',
    hubType: HubType.CITY,
    parentCode: 'UP_STATE',
    lat: 26.8467,
    lng: 80.9462,
    pincodeRanges: [{ from: '226001', to: '226099' }],
  },
  {
    code: 'CHD_CC',
    name: 'Chandigarh City Hub',
    city: 'Chandigarh',
    state: 'Chandigarh',
    hubType: HubType.CITY,
    parentCode: 'CH_UT',
    lat: 30.7333,
    lng: 76.7794,
    pincodeRanges: [{ from: '160001', to: '160099' }],
  },
  {
    code: 'IDR_CC',
    name: 'Indore City Hub',
    city: 'Indore',
    state: 'Madhya Pradesh',
    hubType: HubType.CITY,
    parentCode: 'MP_STATE',
    lat: 22.7196,
    lng: 75.8577,
    pincodeRanges: [{ from: '452001', to: '452099' }],
  },
  {
    code: 'BHOPAL_CC',
    name: 'Bhopal City Hub',
    city: 'Bhopal',
    state: 'Madhya Pradesh',
    hubType: HubType.CITY,
    parentCode: 'MP_STATE',
    lat: 23.2599,
    lng: 77.4126,
    pincodeRanges: [{ from: '462001', to: '462099' }],
  },
  {
    code: 'BHOPAL_DC1',
    name: 'Bhopal Delivery Center — MP Nagar',
    city: 'Bhopal',
    state: 'Madhya Pradesh',
    hubType: HubType.DELIVERY_CENTER,
    parentCode: 'BHOPAL_CC',
    lat: 23.22,
    lng: 77.43,
    pincodeRanges: [{ from: '462011', to: '462023' }],
  },
]

const PINCODE_ROWS: {
  pincode: string
  city: string
  state: string
  lat: number
  lng: number
  zone: DeliveryZoneClass
  hubCode: string
}[] = [
  { pincode: '110001', city: 'New Delhi', state: 'Delhi', lat: 28.61, lng: 77.21, zone: DeliveryZoneClass.SAME_DAY, hubCode: 'DEL_NHD' },
  { pincode: '110092', city: 'New Delhi', state: 'Delhi', lat: 28.63, lng: 77.27, zone: DeliveryZoneClass.NEXT_DAY, hubCode: 'DEL_NHD' },
  { pincode: '400001', city: 'Mumbai', state: 'Maharashtra', lat: 18.94, lng: 72.83, zone: DeliveryZoneClass.STANDARD, hubCode: 'MUM_CC' },
  { pincode: '400053', city: 'Mumbai', state: 'Maharashtra', lat: 19.11, lng: 72.85, zone: DeliveryZoneClass.STANDARD, hubCode: 'MUM_CC' },
  { pincode: '560001', city: 'Bengaluru', state: 'Karnataka', lat: 12.97, lng: 77.59, zone: DeliveryZoneClass.STANDARD, hubCode: 'BLR_CC' },
  { pincode: '560103', city: 'Bengaluru', state: 'Karnataka', lat: 12.93, lng: 77.68, zone: DeliveryZoneClass.NEXT_DAY, hubCode: 'BLR_CC' },
  { pincode: '500001', city: 'Hyderabad', state: 'Telangana', lat: 17.38, lng: 78.48, zone: DeliveryZoneClass.STANDARD, hubCode: 'HYD_CC' },
  { pincode: '600001', city: 'Chennai', state: 'Tamil Nadu', lat: 13.08, lng: 80.27, zone: DeliveryZoneClass.STANDARD, hubCode: 'CHN_CC' },
  { pincode: '700001', city: 'Kolkata', state: 'West Bengal', lat: 22.57, lng: 88.36, zone: DeliveryZoneClass.STANDARD, hubCode: 'KOL_CC' },
  { pincode: '411001', city: 'Pune', state: 'Maharashtra', lat: 18.52, lng: 73.85, zone: DeliveryZoneClass.STANDARD, hubCode: 'PNQ_CC' },
  { pincode: '380001', city: 'Ahmedabad', state: 'Gujarat', lat: 23.03, lng: 72.58, zone: DeliveryZoneClass.STANDARD, hubCode: 'AMD_CC' },
  { pincode: '302001', city: 'Jaipur', state: 'Rajasthan', lat: 26.92, lng: 75.78, zone: DeliveryZoneClass.STANDARD, hubCode: 'JAI_CC' },
  { pincode: '226001', city: 'Lucknow', state: 'Uttar Pradesh', lat: 26.85, lng: 80.95, zone: DeliveryZoneClass.STANDARD, hubCode: 'LKO_CC' },
  { pincode: '160001', city: 'Chandigarh', state: 'Chandigarh', lat: 30.73, lng: 76.78, zone: DeliveryZoneClass.NEXT_DAY, hubCode: 'CHD_CC' },
  { pincode: '452001', city: 'Indore', state: 'Madhya Pradesh', lat: 22.72, lng: 75.86, zone: DeliveryZoneClass.STANDARD, hubCode: 'IDR_CC' },
  { pincode: '462001', city: 'Bhopal', state: 'Madhya Pradesh', lat: 23.26, lng: 77.41, zone: DeliveryZoneClass.STANDARD, hubCode: 'BHOPAL_CC' },
  { pincode: '462016', city: 'Bhopal', state: 'Madhya Pradesh', lat: 23.22, lng: 77.43, zone: DeliveryZoneClass.STANDARD, hubCode: 'BHOPAL_DC1' },
  {
    pincode: '744101',
    city: 'Port Blair',
    state: 'Andaman and Nicobar Islands',
    lat: 11.67,
    lng: 92.74,
    zone: DeliveryZoneClass.REMOTE,
    hubCode: 'KOL_CC',
  },
]

async function main() {
  const idByCode: Record<string, string> = {}

  for (const row of HUBS) {
    const parentId =
      row.parentCode && idByCode[row.parentCode] ?
        idByCode[row.parentCode]
      : null
    const hub = await prisma.hub.upsert({
      where: { code: row.code },
      create: {
        code: row.code,
        name: row.name,
        city: row.city,
        state: row.state,
        hubType: row.hubType,
        parentHubId: parentId,
        latitude: row.lat,
        longitude: row.lng,
        address: `${row.city}, ${row.state}`,
        pincodeRanges: row.pincodeRanges ?? undefined,
      },
      update: {
        name: row.name,
        city: row.city,
        state: row.state,
        hubType: row.hubType,
        parentHubId: parentId,
        latitude: row.lat,
        longitude: row.lng,
        pincodeRanges: row.pincodeRanges ?? undefined,
      },
    })
    idByCode[row.code] = hub.id
  }

  const nationalId = idByCode['DEL_NHD']!

  await prisma.interHubRoute.deleteMany({})
  const routeRows: {
    originHubId: string
    destHubId: string
    mode: TransportMode
    transitDays: number
    distanceKm: number
  }[] = []

  const cityCodes = HUBS.filter((h) => h.hubType === HubType.CITY).map((h) => h.code)

  for (const code of cityCodes) {
    const destId = idByCode[code]
    const longHaul = ['BLR_CC', 'CHN_CC', 'HYD_CC'].includes(code)
    routeRows.push({
      originHubId: nationalId,
      destHubId: destId,
      mode: longHaul ? TransportMode.AIR : TransportMode.SURFACE,
      transitDays: longHaul ? 2 : 3,
      distanceKm: longHaul ? 1500 : 800,
    })
    routeRows.push({
      originHubId: destId,
      destHubId: nationalId,
      mode: longHaul ? TransportMode.AIR : TransportMode.SURFACE,
      transitDays: longHaul ? 2 : 3,
      distanceKm: longHaul ? 1500 : 800,
    })
  }

  /** Undirected pairs; loop below adds both directions. */
  const pairs: [string, string, number][] = [
    ['MUM_CC', 'BLR_CC', 3],
    ['MUM_CC', 'JAI_CC', 3],
    ['BHOPAL_CC', 'BHOPAL_DC1', 1],
  ]
  for (const [a, b, days] of pairs) {
    routeRows.push({
      originHubId: idByCode[a]!,
      destHubId: idByCode[b]!,
      mode: TransportMode.SURFACE,
      transitDays: days,
      distanceKm: 50,
    })
    routeRows.push({
      originHubId: idByCode[b]!,
      destHubId: idByCode[a]!,
      mode: TransportMode.SURFACE,
      transitDays: days,
      distanceKm: 50,
    })
  }

  await prisma.interHubRoute.createMany({ data: routeRows })

  for (const p of PINCODE_ROWS) {
    const hubId = idByCode[p.hubCode]
    if (!hubId) continue
    await prisma.pincodeDirectory.upsert({
      where: { pincode: p.pincode },
      create: {
        pincode: p.pincode,
        city: p.city,
        state: p.state,
        latitude: p.lat,
        longitude: p.lng,
        zoneClass: p.zone,
        serviceHubId: hubId,
      },
      update: {
        city: p.city,
        state: p.state,
        latitude: p.lat,
        longitude: p.lng,
        zoneClass: p.zone,
        serviceHubId: hubId,
      },
    })
  }

  const slabs = [
    {
      code: 'SLAB_LIGHT',
      label: '0–2 kg',
      minDeadWeightGrams: 0,
      maxDeadWeightGrams: 2000,
      baseFeePaise: 12_000,
      per500gPaise: 900,
    },
    {
      code: 'SLAB_MEDIUM',
      label: '2–10 kg',
      minDeadWeightGrams: 2001,
      maxDeadWeightGrams: 10_000,
      baseFeePaise: 18_000,
      per500gPaise: 1200,
    },
    {
      code: 'SLAB_HEAVY',
      label: '10–30 kg',
      minDeadWeightGrams: 10_001,
      maxDeadWeightGrams: 30_000,
      baseFeePaise: 35_000,
      per500gPaise: 1500,
    },
  ]

  for (const s of slabs) {
    await prisma.indiaPricingSlab.upsert({
      where: { code: s.code },
      create: {
        code: s.code,
        label: s.label,
        minDeadWeightGrams: s.minDeadWeightGrams,
        maxDeadWeightGrams: s.maxDeadWeightGrams,
        baseFeePaise: s.baseFeePaise,
        per500gPaise: s.per500gPaise,
        active: true,
      },
      update: {
        label: s.label,
        minDeadWeightGrams: s.minDeadWeightGrams,
        maxDeadWeightGrams: s.maxDeadWeightGrams,
        baseFeePaise: s.baseFeePaise,
        per500gPaise: s.per500gPaise,
        active: true,
      },
    })
  }

  const bhopalId = idByCode['BHOPAL_CC']!
  await prisma.hubZone.upsert({
    where: { hubId_code: { hubId: bhopalId, code: 'BPL_CITY' } },
    create: {
      hubId: bhopalId,
      code: 'BPL_CITY',
      name: 'Bhopal hyperlocal',
      zoneClass: DeliveryZoneClass.STANDARD,
      priority: 0,
      active: true,
    },
    update: { zoneClass: DeliveryZoneClass.STANDARD, active: true },
  })

  await prisma.hubZonePricing.upsert({
    where: { hubId_zoneCode: { hubId: bhopalId, zoneCode: 'DEFAULT' } },
    create: {
      hubId: bhopalId,
      zoneCode: 'DEFAULT',
      minLat: 22.8,
      maxLat: 23.6,
      minLng: 76.8,
      maxLng: 77.9,
      baseCents: 12_000,
      perKmCents: 150,
      orderType: OrderType.LOCAL_DELIVERY,
      active: true,
    },
    update: {
      baseCents: 12_000,
      perKmCents: 150,
      active: true,
    },
  })

  const sellers = await prisma.seller.findMany({ include: { wallet: true } })
  for (const s of sellers) {
    if (!s.wallet) {
      await prisma.wallet.create({
        data: { sellerId: s.id, balanceCents: 0, currency: 'INR' },
      })
    }
  }

  await seedDemoAuthFromEnv()
  await seedProductionWorkerFromEnv()

  console.log(
    'Seed OK — hubs:',
    HUBS.length,
    'inter-hub routes:',
    routeRows.length,
    'pincodes:',
    PINCODE_ROWS.length
  )
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
