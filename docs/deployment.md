# Production deployment (Vercel + Render + Supabase)

This monolith API (`apps/api`) serves REST on HTTP and Socket.IO on the **same** Node process. Frontends are Next.js apps that call the API with JWTs stored in `localStorage` (demo); harden with httpOnly cookies and CSRF as you mature.

**Recommended stack for this repo:** **Supabase** (managed PostgreSQL + optional Storage), **Render** (API + optional worker), **Vercel** (Next.js apps). Use **pgAdmin 4** (or any Postgres client) against the same `DATABASE_URL` from the Supabase dashboard for browsing and ad-hoc SQL — it is not a separate database, only a UI.

## Architecture

| Layer | Suggested host | Notes |
|--------|-----------------|------|
| PostgreSQL | **Supabase** (project → Database → connection string) | Set `DATABASE_URL` on the API. Use the **pooler** URI for app traffic if you use Prisma with `DIRECT_URL` for migrations (see Supabase + Prisma docs). Add `?sslmode=require` if required. |
| Redis | Render Redis, Upstash, or self-hosted | Optional; queues + rate limits |
| API + Socket.IO | **Render** Web Service | Start after `pnpm --filter @repo/api build` |
| Object storage (hub photos, etc.) | **Supabase Storage** | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET` on the API |
| Seller / Admin / Worker UI | **Vercel** (one project per app) | Root directory + install/build from monorepo root |

**Alternatives (also valid):** any managed Postgres (RDS, Neon, Railway Postgres, etc.) and any host for the API (Railway, Fly, etc.) — Prisma only needs a real `postgresql://` URL.

## Environment variables

### API (Render)

| Variable | Example |
|----------|---------|
| `NODE_ENV` | `production` |
| `PORT` | Leave unset on **Render** (the platform injects `PORT` automatically). Do not type `3001` unless you know you need it. |
| `DATABASE_URL` | `postgresql://…` from **Supabase → Database** (**required**; add `?sslmode=require` if your provider needs TLS) |
| `DIRECT_URL` | Optional; non-pooler URL for Prisma migrations when using Supabase pooler (see Prisma docs) |
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
| `SUPABASE_URL` | `https://<project>.supabase.co` (for Storage signed uploads) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (**server only**) |
| `SUPABASE_STORAGE_BUCKET` | e.g. `thtwaat` |

After changing Prisma models for payments, run migrations (or `prisma db push` in dev) so `RazorpayPayment`, `SellerSubscription`, and `Order.shippingPaidAt` exist.

Customer WhatsApp messages are queued as `IntegrationJob` rows (`WHATSAPP_NOTIFY`) and processed by the **integration worker** (`pnpm --filter @repo/api run worker:integrations` or `node apps/api/dist/integration-worker.js`). Ensure that worker runs in production alongside the API.

### Next.js (Vercel, each app)

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_API_URL` | Public HTTPS URL of the **Render** API |
| `NEXT_PUBLIC_SOCKET_URL` | Same as API if Socket.IO is colocated (default) |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | Same publishable Key ID as `RAZORPAY_KEY_ID` so Checkout.js can open (test: `rzp_test_…`) |

Do **not** expose `JWT_SECRET`, `DATABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, or `RAZORPAY_KEY_SECRET` to the browser.

## Vercel (Next.js)

1. Create a project; set **Root Directory** to `apps/seller-web` (or admin/worker).
2. **Install**: `pnpm install` from repository root (use monorepo docs: install at root with `corepack enable` + `pnpm`).
3. **Build**: `cd ../.. && pnpm --filter @repo/seller-web run build` or configure Turborepo remote cache.
4. **Output**: default Next.js on Vercel.

Repeat per app with different root directories or use a single Vercel monorepo with multiple projects.

## Render (API)

Use the **repository root** as the service root so `pnpm` workspaces resolve. The `@repo/api` **build** runs `prisma generate` + `tsc`; **`prisma migrate deploy` runs on `start`** (when the service boots). Set `DATABASE_URL` and `DIRECT_URL` on Render before deploy.

**Render env paste (P1000 fix):** In the dashboard value field, paste the URI **without** surrounding `"` quotes. Wrong: `"postgresql://...` (quote in value). Right: `postgresql://postgres.<ref>:<password>@aws-....pooler.supabase.com:6543/postgres?pgbouncer=true`. Copy both strings from Supabase **Connect → ORM** (Copy button). `DIRECT_URL` must use session pooler port **5432**, same password as `DATABASE_URL`.

1. New Web Service from repo; **build** with something like:  
   `corepack enable && corepack prepare pnpm@9.15.0 --activate && pnpm install --frozen-lockfile && pnpm --filter @repo/api run build`
2. **Start**: `pnpm --filter @repo/api start` (or `node apps/api/dist/server.js` from repo root).
3. Set **`CORS_ORIGIN`** on the API to a comma-separated list of your deployed Next.js origins (scheme + host, no path), e.g. `https://seller.vercel.app,https://admin.vercel.app,https://worker.vercel.app`. If you omit it, Express and Socket.IO reflect the browser `Origin` header, which often works but is looser than an explicit allowlist.
4. Set **`DATABASE_URL`** (and `DIRECT_URL` if using Supabase pooler + Prisma migrate) from the Supabase dashboard — not Neon unless you chose Neon as your Postgres host.
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

**Option E — admin only (Render / production DB):** run seed once with `SEED_PRODUCTION_ADMIN=1` and production `DATABASE_URL`. Creates or updates `admin@thtwaat.com` / `admin123` as `ADMIN` (bcrypt cost 12, same as API); removes conflicting `Worker` / `Seller` / org membership rows for that user; revokes refresh tokens. Logs `SEED_PRODUCTION_ADMIN: success` on completion. **Unset after run** and rotate the password.

**Option F — fixed role users (admin / worker / seller):** run seed once with `SEED_FIXED_PRODUCTION_USERS=1` (and `DATABASE_URL` pointing at production). Same admin as Option E, plus `worker@thtwaat.com` / `worker123` (`WORKER`, home hub **Bangalore City Hub** `BLR_CC`, `isActive=true`), `seller@thtwaat.com` / `seller123` (`SELLER` + workspace + wallet). Worker/seller are skipped if `BLR_CC` is missing (admin still applies). **Unset after the run** and change passwords in production.

## Database

- Use **Supabase Postgres** (or another managed Postgres); enable TLS.
- **pgAdmin 4:** create a server using the same host/port/user/password as in `DATABASE_URL` (from Supabase **Database** → connection parameters). This does not replace Supabase; it is only a management UI.
- Run `prisma migrate deploy` in release phase, not only on developer laptops.

## Scaling notes

- Horizontally scale API only behind a **sticky-session** load balancer if you use multiple Socket.IO nodes, or move to a Redis adapter for Socket.IO rooms.
- Rate limiting is already applied on auth routes; tune Redis and `express-rate-limit` for production traffic.
- For thousands of sellers, keep **tenant filters** on every query (`organizationId` / `sellerId` from JWT or API key).
