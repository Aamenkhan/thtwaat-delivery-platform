import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifyEdgeToken } from '@repo/web-core/edge-auth'

const WORKER_ROLES = new Set(['WORKER', 'DELIVERY_WORKER'])

export async function middleware(req: NextRequest) {
  const token = req.cookies.get('thtwaat_access_token')?.value

  if (!token) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  const payload = await verifyEdgeToken(token)

  if (!payload || !WORKER_ROLES.has(payload.role)) {
    return NextResponse.redirect(new URL('/login?error=unauthorized', req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*'],
}
