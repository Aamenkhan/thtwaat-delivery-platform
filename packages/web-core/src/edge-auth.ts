import { jwtVerify } from 'jose'

export async function verifyEdgeToken(token: string) {
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET)
    const { payload } = await jwtVerify(token, secret)
    return payload as { sub: string; role: string; orgId?: string; membershipRole?: string }
  } catch (err) {
    return null
  }
}
