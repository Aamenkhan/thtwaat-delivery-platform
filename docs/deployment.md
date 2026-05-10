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
| `PORT` | Leave unset on **Render** (the platform injects `PORT` automatically). Do not type `3001` unless you know you need it. |
| `DATABASE_URL` | `postgresql://…` (**required**; add `?sslmode=require` if your provider needs TLS) |
| `REDIS_URL` | `redis://…` (optional). If you are not using Redis, **delete** this variable — do not set it to `disabled` (older builds treated that as a hostname). |
| `JWT_SECRET` | Long random string (**required** — without it login/register return 500) |
| `CORS_ORIGIN` | `https://seller.example.com,https://admin.example.com,https://worker.example.com` |
| `SOCKET_REQUIRE_AUTH` | `1` to require JWT on Socket.IO handshake |
| `OTP_PEPPER` | Strong secret for OTP hashing |
| `WEBHOOK_SIGNING_SECRET` | For outbound webhooks |
| `WHATSAPP_ACCESS_TOKEN` | Meta WhatsApp Cloud API user token (optional; without it WhatsApp jobs no-op) |
| `WHATSAPP_PHONE_NUMBER_ID` | Meta *Phone number ID* for sending |
| `WHATSAPP_GRAPH_API_VERSION` | Optional API version segment (default `v20.0`) |
| `RAZORPAY_KEY_ID` | `rzp_test_…` or `rzp_live_…` (Dashboard → API Keys) |
| `RAZORPAY_KEY_SECRET` | Secret key for server-side order creation and signature verification |
| `RAZORPAY_WEBHOOK_SECRET` | Webhook signing secret from Razorpay Dashboard (path `/v1/integrations/razorpay/webhook`) |

After changing Prisma models for payments, run migrations (or `prisma db push` in dev) so `RazorpayPayment`, `SellerSubscription`, and `Order.shippingPaidAt` exist.

Customer WhatsApp messages are queued as `IntegrationJob` rows (`WHATSAPP_NOTIFY`) and processed by the **integration worker** (`pnpm --filter @repo/api run worker:integrations` or `node apps/api/dist/integration-worker.js`). Ensure that worker runs in production alongside the API.

### Next.js (Vercel, each app)

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_API_URL` | Public HTTPS URL of the Railway API |
| `NEXT_PUBLIC_SOCKET_URL` | Same as API if Socket.IO is colocated (default) |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | Same publishable Key ID as `RAZORPAY_KEY_ID` so Checkout.js can open (test: `rzp_test_…`) |

Do **not** expose `JWT_SECRET`, `DATABASE_URL`, or `RAZORPAY_KEY_SECRET` to the browser.

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
5. Run migrations once against production: from a shell with `DATABASE_URL` set,  
   `pnpm exec prisma migrate deploy --schema packages/db/prisma/schema.prisma`  
   (or add a Render **Shell** / release command). Without migrated tables, auth routes can fail with **500 / Internal server error**.

Each Next app ships a committed **`.env.production`** pointing at the shared API URL so `next build` embeds `NEXT_PUBLIC_API_URL` without relying on host-specific secrets. Override per environment in the Vercel dashboard if needed.

### First login on production

The seed script only creates hubs and pricing by default; it does **not** create users unless you opt in. If `POST /v1/auth/login` returns **401 Invalid credentials**, the email is missing in the production database or the password does not match.

**Option A — seller UI:** open **`/register`** on the seller Next app (e.g. `https://…vercel.app/register`), create an account (password ≥ 8 characters), then use the same email on **Login**.

**Option B — register via API:** `POST https://<your-api>/v1/auth/register` with JSON matching `registerBody` and `"role":"SELLER"`.

**Option C — seed a demo seller (one-off):** with `DATABASE_URL` pointing at production, run:

`DEMO_SEED_EMAIL=you@example.com DEMO_SEED_PASSWORD='…' pnpm --filter @repo/db run seed`

Unset those variables after the first run so the password is not kept in shell history longer than needed. Re-running with the same email only updates the password hash.

**Option D — seed a worker account (worker-web on Vercel):** after hubs exist in the DB (seed has already created **Bangalore City Hub** as `BLR_CC`), run once with a strong password, then unset:

`WORKER_SEED_EMAIL=worker@yourdomain.com WORKER_SEED_PASSWORD='…' pnpm --filter @repo/db run seed`

Optional: `WORKER_SEED_HUB_CODE=BLR_CC` (default), `WORKER_SEED_DISPLAY_NAME`, `WORKER_SEED_PHONE`. This creates or updates the user with `Role.WORKER`, bcrypt-hashes the password, links a `Worker` row with `isActive=true` and `homeHubId` set to that hub. Apply the Prisma migration that adds `Worker.homeHubId` before relying on hub assignment.

## Database

- Use **managed PostgreSQL**; enable TLS.
- Run `prisma migrate deploy` in release phase, not only on developer laptops.

## Scaling notes

- Horizontally scale API only behind a **sticky-session** load balancer if you use multiple Socket.IO nodes, or move to a Redis adapter for Socket.IO rooms.
- Rate limiting is already applied on auth routes; tune Redis and `express-rate-limit` for production traffic.
- For thousands of sellers, keep **tenant filters** on every query (`organizationId` / `sellerId` from JWT or API key).
