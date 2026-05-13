import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * See `apps/seller-web/src/middleware.ts` — API auth cookies are host-scoped;
 * dashboard protection uses `WorkerAuthGate` + localStorage JWT.
 */
export function middleware(_req: NextRequest) {
  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*'],
}
