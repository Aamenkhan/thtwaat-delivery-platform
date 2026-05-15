import { getApiBaseUrl } from '@repo/web-core/api'

import { writeWorkerSession } from './worker-session'

function apiV1() {
  return `${getApiBaseUrl().replace(/\/$/, '')}/api/v1`
}

export class WorkerApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message)
    this.name = 'WorkerApiError'
  }
}

async function parseJson(res: Response): Promise<{ ok?: boolean; data?: unknown; error?: unknown }> {
  const text = await res.text()
  if (!text) return {}
  try {
    return JSON.parse(text) as { ok?: boolean; data?: unknown; error?: unknown }
  } catch {
    return { error: { message: text } }
  }
}

export type WorkerFetchInit = RequestInit & {
  token?: string | null
  /** Do not attach Authorization (e.g. login/register). */
  skipAuth?: boolean
}

/** After email/Google login: map `User` → worker row → gig JWT + localStorage (same as phone OTP). */
export async function exchangeWorkerGigSessionFromAccessToken(accessToken: string): Promise<void> {
  const url = `${apiV1()}/workers/session-from-user`
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  })
  const body = await parseJson(res)
  if (!res.ok || !body.ok) {
    const msg =
      typeof body.error === 'object' &&
      body.error &&
      'message' in body.error &&
      typeof (body.error as { message?: string }).message === 'string'
        ? (body.error as { message: string }).message
        : `Worker session failed (${res.status})`
    throw new WorkerApiError(res.status, msg)
  }
  const data = body.data as { token?: string; worker?: { id?: string } }
  if (!data?.token || !data.worker?.id) {
    throw new WorkerApiError(500, 'Invalid session response')
  }
  writeWorkerSession(data.token, data.worker.id)
}

export async function workerFetch<T>(path: string, init: WorkerFetchInit = {}): Promise<T> {
  const url = `${apiV1()}${path.startsWith('/') ? path : `/${path}`}`
  const headers = new Headers(init.headers)
  headers.set('Accept', 'application/json')
  const token = init.skipAuth
    ? null
    : (init.token ??
      (typeof window !== 'undefined' ? localStorage.getItem('thtwaat_worker_token') : null))
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (init.body && typeof init.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const res = await fetch(url, { ...init, headers })
  const body = await parseJson(res)
  if (res.status === 401) {
    const { clearWorkerSession } = await import('./worker-session')
    clearWorkerSession()
    if (typeof window !== 'undefined') window.location.href = '/login'
    throw new WorkerApiError(401, 'Unauthorized')
  }
  if (!res.ok) {
    const msg =
      typeof body.error === 'object' &&
      body.error &&
      'message' in body.error &&
      typeof (body.error as { message?: string }).message === 'string'
        ? (body.error as { message: string }).message
        : `HTTP ${res.status}`
    throw new WorkerApiError(res.status, msg)
  }
  return body.data as T
}
