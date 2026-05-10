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

## Railway / Render (API)

Use the **repository root** as the service root so `pnpm` workspaces resolve. The `@repo/api` **build** script runs `prisma generate` before `tsc`, so you do not need a separate generate step unless you prefer one.

1. New service from repo; **build** with something like:  
   `corepack enable && corepack prepare pnpm@9.15.0 --activate && pnpm install --frozen-lockfile && pnpm --filter @repo/api run build`
2. **Start**: `pnpm --filter @repo/api start` (or `node apps/api/dist/server.js` from repo root).
3. Set **`CORS_ORIGIN`** on the API to a comma-separated list of your deployed Next.js origins (scheme + host, no path), e.g. `https://seller.vercel.app,https://admin.vercel.app,https://worker.vercel.app`. If you omit it, Express and Socket.IO reflect the browser `Origin` header, which often works but is looser than an explicit allowlist.
4. Attach **PostgreSQL** plugin and copy connection string into `DATABASE_URL`.
5. Run migrations: `pnpm db:migrate` or `prisma migrate deploy` in CI against production.

Each Next app ships a committed **`.env.production`** pointing at the shared API URL so `next build` embeds `NEXT_PUBLIC_API_URL` without relying on host-specific secrets. Override per environment in the Vercel dashboard if needed.

## Database

- Use **managed PostgreSQL**; enable TLS.
- Run `prisma migrate deploy` in release phase, not only on developer laptops.

## Scaling notes

- Horizontally scale API only behind a **sticky-session** load balancer if you use multiple Socket.IO nodes, or move to a Redis adapter for Socket.IO rooms.
- Rate limiting is already applied on auth routes; tune Redis and `express-rate-limit` for production traffic.
- For thousands of sellers, keep **tenant filters** on every query (`organizationId` / `sellerId` from JWT or API key).
