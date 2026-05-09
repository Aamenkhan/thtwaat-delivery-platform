import { randomInt } from 'node:crypto'
import { Hono } from 'hono'
import { z } from 'zod'
import { prisma } from '../../lib/db.js'
import { hashOtpCode, timingSafeEqualHex } from '../../lib/crypto.js'
import { jsonError, jsonOk } from '../../lib/http.js'

const requestBody = z.object({
  phone: z.string().min(5),
  purpose: z.enum(['delivery', 'return', 'seller_login']),
})

const verifyBody = z.object({
  phone: z.string().min(5),
  code: z.string().min(4).max(10),
  purpose: z.enum(['delivery', 'return', 'seller_login']),
})

export const otpRoutes = new Hono()

otpRoutes.post('/request', async (c) => {
  const parsed = requestBody.safeParse(await c.req.json())
  if (!parsed.success) {
    return jsonError(c, 'validation_error', 'Invalid body', 422, parsed.error)
  }

  const code = String(randomInt(100000, 999999))
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000)

  await prisma.otpChallenge.create({
    data: {
      phone: parsed.data.phone,
      codeHash: hashOtpCode(code, parsed.data.phone),
      purpose: parsed.data.purpose,
      expiresAt,
    },
  })

  // Production: send SMS via provider; dev returns code for local testing only.
  if (process.env.NODE_ENV === 'production') {
    return jsonOk(c, { sent: true })
  }
  return jsonOk(c, { sent: true, _devCode: code })
})

otpRoutes.post('/verify', async (c) => {
  const parsed = verifyBody.safeParse(await c.req.json())
  if (!parsed.success) {
    return jsonError(c, 'validation_error', 'Invalid body', 422, parsed.error)
  }

  const challenge = await prisma.otpChallenge.findFirst({
    where: {
      phone: parsed.data.phone,
      purpose: parsed.data.purpose,
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  })

  if (!challenge) {
    return jsonError(c, 'otp_invalid', 'No active challenge', 400)
  }

  const expected = hashOtpCode(parsed.data.code, parsed.data.phone)
  if (!timingSafeEqualHex(challenge.codeHash, expected)) {
    return jsonError(c, 'otp_invalid', 'Invalid code', 400)
  }

  await prisma.otpChallenge.update({
    where: { id: challenge.id },
    data: { consumedAt: new Date() },
  })

  return jsonOk(c, { verified: true })
})
