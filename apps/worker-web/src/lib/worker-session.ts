export const WORKER_TOKEN_KEY = 'thtwaat_worker_token'
export const WORKER_ID_KEY = 'thtwaat_worker_id'

export function writeWorkerSession(token: string, workerId: string) {
  if (typeof window === 'undefined') return
  localStorage.setItem(WORKER_TOKEN_KEY, token)
  localStorage.setItem(WORKER_ID_KEY, workerId)
}

export function readWorkerToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(WORKER_TOKEN_KEY)
}

export function readWorkerId(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(WORKER_ID_KEY)
}

export function clearWorkerSession() {
  if (typeof window === 'undefined') return
  localStorage.removeItem(WORKER_TOKEN_KEY)
  localStorage.removeItem(WORKER_ID_KEY)
}
