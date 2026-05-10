import { DeliveryZoneClass } from '@prisma/client'
import { prisma } from '../../lib/prisma.js'
import { distanceKm } from '../../lib/geo.js'

function volumetricGrams(
  lengthCm: number,
  widthCm: number,
  heightCm: number,
  divisor: number
) {
  return (lengthCm * widthCm * heightCm) / divisor
}

function zoneExpressMultiplier(z: DeliveryZoneClass): number {
  switch (z) {
    case DeliveryZoneClass.SAME_DAY:
      return 1.55
    case DeliveryZoneClass.NEXT_DAY:
      return 1.4
    case DeliveryZoneClass.STANDARD:
      return 1.0
    case DeliveryZoneClass.REMOTE:
      return 1.25
    default:
      return 1.0
  }
}

export type IndiaPriceInput = {
  deadWeightGrams: number
  lengthCm?: number
  widthCm?: number
  heightCm?: number
  codAmountPaise: number
  originLat: number
  originLng: number
  destLat: number
  destLng: number
  originState: string
  destState: string
  destZoneClass: DeliveryZoneClass
  express?: boolean
}

/**
 * Dynamic India pricing: slab + volumetric + COD% + fuel% + interstate flat + zone/express multipliers.
 */
export async function quoteIndia(input: IndiaPriceInput) {
  const slabs = await prisma.indiaPricingSlab.findMany({
    where: { active: true },
    orderBy: { minDeadWeightGrams: 'asc' },
  })
  const slab =
    slabs.find(
      (s) =>
        input.deadWeightGrams >= s.minDeadWeightGrams &&
        input.deadWeightGrams <= s.maxDeadWeightGrams
    ) ?? slabs[0]

  if (!slab) {
    throw new Error('No IndiaPricingSlab configured')
  }

  let volG = 0
  if (
    input.lengthCm &&
    input.widthCm &&
    input.heightCm &&
    slab.volumetricDivisor > 0
  ) {
    volG = volumetricGrams(
      input.lengthCm,
      input.widthCm,
      input.heightCm,
      slab.volumetricDivisor
    )
  }

  const chargeableG = Math.max(input.deadWeightGrams, volG)
  const extra500g = Math.max(0, Math.ceil(chargeableG / 500) - 1)
  const base =
    slab.baseFeePaise + extra500g * (slab.per500gPaise ?? 800)

  const interstate =
    input.originState.trim().toLowerCase() !==
    input.destState.trim().toLowerCase()
      ? slab.interstateFeePaise
      : 0

  const codFee = Math.round(input.codAmountPaise * slab.codFeePercent)
  const afterCod = base + interstate + codFee
  const fuel = Math.round(afterCod * slab.fuelSurchargePercent)

  const dist = distanceKm(
    { lat: input.originLat, lng: input.originLng },
    { lat: input.destLat, lng: input.destLng }
  )

  const zoneMul = zoneExpressMultiplier(input.destZoneClass)
  const expressMul =
    input.express ? slab.expressMultiplier * zoneMul : zoneMul

  const totalPaise = Math.round((afterCod + fuel) * expressMul)

  return {
    currency: 'INR',
    amountCents: totalPaise,
    breakdown: {
      slabCode: slab.code,
      chargeableGrams: Math.round(chargeableG),
      deadWeightGrams: input.deadWeightGrams,
      volumetricGrams: Math.round(volG),
      baseFeePaise: slab.baseFeePaise,
      extra500gBlocks: extra500g,
      per500gPaise: slab.per500gPaise,
      interstateFeePaise: interstate,
      codFeePaise: codFee,
      fuelSurchargePaise: fuel,
      distanceKm: Math.round(dist * 100) / 100,
      zoneMultiplier: zoneMul,
      expressApplied: Boolean(input.express),
      expressMultiplier: slab.expressMultiplier,
    },
  }
}
