# Production deployment (Vercel + Railway + PostgreSQL)

This monolith API (`apps/api`) serves REST on HTTP and Socket.IO on the **same** Node process. Frontends are Next.js apps that call the API with JWTs stored in `localStorage` (demo); harden with httpOnly cookies and CSRF as you mature.

## Architecture

| Layer | Suggested host | Notes |
|--------|-----------------|------|
| PostgreSQL | Railway Postgres (or Neon, RDS) | Set `DATABASE_URL` on API service |
| Redis | Railway Redis | Optional; queues + rate limits |
| API + Socket.IO | **Railway** one service | Start command `node apps/api/dist/server.js` after `pnpm --filter @repo/api build` |
| Seller UI | **Vercel** project → `apps/seller-web` | Root directory + install/build filters |
| Admin UI | Vercel second project → `apps/admin-web` | Same pattern |
| Worker UI | Vercel third project → `apps/worker-web` | Mobile-friendly field flows |

## Environment variables

### API (Railway)

| Variable | Example |
|----------|---------|
| `NODE_ENV` | `production` |
| `PORT` | `4000` (Railway sets `PORT` automatically) |
| `DATABASE_URL` | `postgresql://…` |
| `REDIS_URL` | `redis://…` (optional) |
| `JWT_SECRET` | Long random string |
| `CORS_ORIGIN` | `https://seller.example.com,https://admin.example.com,https://worker.example.com` |
| `SOCKET_REQUIRE_AUTH` | `1` to require JWT on Socket.IO handshake |
| `OTP_PEPPER` | Strong secret for OTP hashing |
| `WEBHOOK_SIGNING_SECRET` | For outbound webhooks |

### Next.js (Vercel, each app)

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_API_URL` | Public HTTPS URL of the Railway API |
| `NEXT_PUBLIC_SOCKET_URL` | Same as API if Socket.IO is colocated (default) |

Do **not** expose `JWT_SECRET` or `DATABASE_URL` to the browser.

## Vercel (Next.js)

1. Create a project; set **Root Directory** to `apps/seller-web` (or admin/worker).
2. **Install**: `pnpm install` from repository root (use monorepo docs: install at root with `corepack enable` + `pnpm`).
3. **Build**: `cd ../.. && pnpm --filter @repo/seller-web run build` or configure Turborepo remote cache.
4. **Output**: default Next.js on Vercel.

Repeat per app with different root directories or use a single Vercel monorepo with multiple projects.

## Railway (API)

1. New service from repo; **build** with something like:  
   `pnpm install && pnpm db:generate && pnpm --filter @repo/api run build`
2. **Start**: `node apps/api/dist/server.js` (adjust paths to your build output).
3. Attach **PostgreSQL** plugin and copy connection string into `DATABASE_URL`.
4. Run migrations: `pnpm db:migrate` or `prisma migrate deploy` in CI against production.

## Database

- Use **managed PostgreSQL**; enable TLS.
- Run `prisma migrate deploy` in release phase, not only on developer laptops.

## Scaling notes

- Horizontally scale API only behind a **sticky-session** load balancer if you use multiple Socket.IO nodes, or move to a Redis adapter for Socket.IO rooms.
- Rate limiting is already applied on auth routes; tune Redis and `express-rate-limit` for production traffic.
- For thousands of sellers, keep **tenant filters** on every query (`organizationId` / `sellerId` from JWT or API key).
