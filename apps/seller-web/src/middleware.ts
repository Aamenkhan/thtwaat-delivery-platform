import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Auth is enforced client-side (`SellerAuthGate` + JWT in localStorage from
 * `loginRequest` / `registerRequest`). We intentionally do not validate
 * `thtwaat_access_token` here: the API sets that cookie on its own host
 * (e.g. Render); it is not sent to this Vercel origin, so a cookie check would
 * always redirect logged-in users back to `/login`.
 */
export function middleware(_req: NextRequest) {
  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*'],
}
