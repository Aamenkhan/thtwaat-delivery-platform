import { apiFetch } from '@repo/web-core/api'

const MAX_BYTES = 2 * 1024 * 1024
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const

export type HubAssetImageType = 'hub' | 'bus' | 'transport' | 'truck'

type SignUploadResponse = {
  ok: boolean
  data: {
    signedUrl: string
    token: string
    path: string
    publicUrl: string
  }
}

/**
 * Hub-scoped images go to Supabase Storage (not Firebase).
 * Server mints a signed upload URL; the browser PUTs the file, then you persist `publicUrl` in the API/DB.
 */
export async function uploadHubImageToSupabase(input: {
  hubId: string
  assetType: HubAssetImageType
  file: File
}): Promise<{ publicUrl: string; path: string }> {
  const { hubId, assetType, file } = input
  if (!ALLOWED_TYPES.includes(file.type as (typeof ALLOWED_TYPES)[number])) {
    throw new Error('Only JPEG, PNG, or WebP images are allowed')
  }
  if (file.size > MAX_BYTES) {
    throw new Error('Image must be 2 MB or smaller')
  }
  const { data } = await apiFetch<SignUploadResponse>('/v1/admin/storage/sign-upload', {
    method: 'POST',
    body: {
      hubId,
      assetType,
      filename: file.name || 'upload.jpg',
      contentType: file.type,
    },
  })
  const putRes = await fetch(data.signedUrl, {
    method: 'PUT',
    body: file,
    headers: {
      'Content-Type': file.type,
      'x-upsert': 'true',
    },
  })
  if (!putRes.ok) {
    const t = await putRes.text().catch(() => '')
    throw new Error(t.slice(0, 200) || `Upload failed (${putRes.status})`)
  }
  return { publicUrl: data.publicUrl, path: data.path }
}
