import { getApiBaseUrl } from '@repo/web-core/api'

export type WorkerKycUploadType =
  | 'aadhaar'
  | 'aadhaar_back'
  | 'pan_front'
  | 'pan_back'
  | 'vehicle_front'
  | 'vehicle_back'
  | 'license'

/** Multipart upload to API (same as seller order photos — not browser Supabase). */
export async function uploadWorkerKycPhoto(
  workerId: string,
  type: WorkerKycUploadType,
  file: File
): Promise<string> {
  const token =
    typeof window !== 'undefined' ? localStorage.getItem('thtwaat_worker_token') : null
  if (!token) throw new Error('Not logged in')

  const base = `${getApiBaseUrl().replace(/\/$/, '')}/api/v1`
  const fd = new FormData()
  fd.append('file', file)
  fd.append('type', type)

  const res = await fetch(`${base}/workers/${workerId}/upload-photo`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  })
  const body = (await res.json()) as {
    ok?: boolean
    data?: { photoUrl?: string }
    error?: { message?: string }
  }
  if (!res.ok || !body.ok || !body.data?.photoUrl) {
    throw new Error(body.error?.message ?? `Upload failed (${res.status})`)
  }
  return body.data.photoUrl
}
