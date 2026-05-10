import {
  readTokens,
  writeTokens,
  writeUser,
  type StoredTokens,
  type StoredUser,
} from './auth-storage'

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: unknown
  ) {
    super(
      typeof body === 'object' &&
        body !== null &&
        'error' in body &&
        typeof (body as { error?: { message?: string } }).error?.message ===
          'string'
        ? (body as { error: { message: string } }).error.message
        : `HTTP ${status}`
    )
    this.name = 'ApiError'
  }
}

const LOCAL_DEV_API = 'http://localhost:4000'

function trimUrl(v: string | undefined): string | undefined {
  const t = v?.trim()
  return t || undefined
}

function requirePublicApiUrlForBrowser(url: string | undefined): string {
  const u = trimUrl(url)
  if (u) return u
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'NEXT_PUBLIC_API_URL must be set for production browser builds (e.g. .env.production or host env).'
    )
  }
  return LOCAL_DEV_API
}

function resolveServerApiBase(): string {
  const u =
    trimUrl(process.env.NEXT_PUBLIC_API_URL) ??
    trimUrl(process.env.API_INTERNAL_URL)
  if (u) return u
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'Set NEXT_PUBLIC_API_URL or API_INTERNAL_URL for production server-side API calls.'
    )
  }
  return LOCAL_DEV_API
}

/** Base URL for REST calls — always prefer `process.env.NEXT_PUBLIC_API_URL` in the browser. */
export function getApiBaseUrl(): string {
  if (typeof window === 'undefined') {
    return resolveServerApiBase()
  }
  return requirePublicApiUrlForBrowser(process.env.NEXT_PUBLIC_API_URL)
}

export function getSocketUrl(): string {
  if (typeof window !== 'undefined') {
    const u =
      trimUrl(process.env.NEXT_PUBLIC_SOCKET_URL) ??
      trimUrl(process.env.NEXT_PUBLIC_API_URL)
    return requirePublicApiUrlForBrowser(u).replace(/\/$/, '')
  }
  const u =
    trimUrl(process.env.NEXT_PUBLIC_SOCKET_URL) ??
    trimUrl(process.env.NEXT_PUBLIC_API_URL) ??
    trimUrl(process.env.API_INTERNAL_URL)
  if (u) return u.replace(/\/$/, '')
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'Set NEXT_PUBLIC_SOCKET_URL, NEXT_PUBLIC_API_URL, or API_INTERNAL_URL for production Socket.IO.'
    )
  }
  return LOCAL_DEV_API.replace(/\/$/, '')
}

async function parseBody(res: Response): Promise<unknown> {
  const text = await res.text()
  if (!text) return {}
  try {
    return JSON.parse(text) as unknown
  } catch {
    return { raw: text }
  }
}

export async function refreshSession(): Promise<StoredTokens | null> {
  const tokens = readTokens()
  if (!tokens?.refreshToken) return null
  const base = getApiBaseUrl()
  const res = await fetch(`${base}/v1/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: tokens.refreshToken }),
  })
  const body = (await parseBody(res)) as {
    ok?: boolean
    data?: StoredTokens & {
      user?: unknown
      accessToken: string
      refreshToken: string
    }
  }
  if (!res.ok || !body?.data?.accessToken || !body?.data?.refreshToken) {
    writeTokens(null)
    writeUser(null)
    return null
  }
  const next: StoredTokens = {
    accessToken: body.data.accessToken,
    refreshToken: body.data.refreshToken,
  }
  writeTokens(next)
  if (body.data.user) writeUser(body.data.user as StoredUser)
  return next
}

export type ApiFetchOptions = Omit<RequestInit, 'body'> & {
  /** Skip attaching Authorization header */
  anonymous?: boolean
  /** Raw body (do not JSON.stringify) */
  rawBody?: BodyInit
  /** JSON-serializable body (or FormData / string when not plain object) */
  body?: unknown
}

export async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions = {}
): Promise<T> {
  const base = getApiBaseUrl()
  const { anonymous, rawBody, headers: hdrs, body, ...rest } = options
  const headers = new Headers(hdrs)

  let access = anonymous ? null : readTokens()?.accessToken
  if (!anonymous && access) {
    headers.set('Authorization', `Bearer ${access}`)
  }

  const isJson =
    body !== undefined &&
    body !== null &&
    typeof body === 'object' &&
    !(body instanceof FormData) &&
    !(body instanceof Blob) &&
    !rawBody

  if (isJson && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const init: RequestInit = {
    ...rest,
    headers,
    body:
      rawBody !== undefined ? rawBody
      : isJson ? JSON.stringify(body)
      : (body as BodyInit | undefined),
  }

  let res = await fetch(`${base}${path}`, init)

  if (res.status === 401 && !anonymous && readTokens()?.refreshToken) {
    const refreshed = await refreshSession()
    if (refreshed?.accessToken) {
      headers.set('Authorization', `Bearer ${refreshed.accessToken}`)
      res = await fetch(`${base}${path}`, { ...init, headers })
    }
  }

  const parsed = await parseBody(res)
  if (!res.ok) {
    throw new ApiError(res.status, parsed)
  }
  return parsed as T
}

export async function registerRequest(input: {
  email: string
  password: string
  phone?: string
  companyName?: string
  fullName?: string
}): Promise<{
  user: { id: string; email: string; role: string }
  accessToken: string
  refreshToken: string
  organizationId?: string | null
  membershipRole?: string | null
}> {
  const base = getApiBaseUrl()
  const res = await fetch(`${base}/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...input,
      role: 'SELLER',
    }),
  })
  const parsed = (await parseBody(res)) as {
    ok?: boolean
    data?: {
      user: { id: string; email: string; role: string }
      accessToken: string
      refreshToken: string
      organizationId?: string | null
      membershipRole?: string | null
    }
  }
  if (!res.ok || !parsed?.data?.accessToken || !parsed?.data?.refreshToken) {
    throw new ApiError(res.status, parsed)
  }
  writeTokens({
    accessToken: parsed.data.accessToken,
    refreshToken: parsed.data.refreshToken,
  })
  writeUser(parsed.data.user)
  return parsed.data
}

export async function loginRequest(input: {
  email: string
  password: string
}): Promise<{
  user: { id: string; email: string; role: string }
  accessToken: string
  refreshToken: string
  organizationId?: string | null
  membershipRole?: string | null
}> {
  const base = getApiBaseUrl()
  const res = await fetch(`${base}/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const parsed = (await parseBody(res)) as {
    ok?: boolean
    data?: {
      user: { id: string; email: string; role: string }
      accessToken: string
      refreshToken: string
      organizationId?: string | null
      membershipRole?: string | null
    }
  }
  if (!res.ok || !parsed?.data?.accessToken || !parsed?.data?.refreshToken) {
    throw new ApiError(res.status, parsed)
  }
  writeTokens({
    accessToken: parsed.data.accessToken,
    refreshToken: parsed.data.refreshToken,
  })
  writeUser(parsed.data.user)
  return parsed.data
}

export async function logoutRequest(): Promise<void> {
  const t = readTokens()
  const refresh = t?.refreshToken
  writeTokens(null)
  writeUser(null)
  if (!refresh) return
  try {
    await fetch(`${getApiBaseUrl()}/v1/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: refresh }),
    })
  } catch {
    /* best-effort */
  }
}
