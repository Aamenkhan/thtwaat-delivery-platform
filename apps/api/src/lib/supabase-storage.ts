import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export const HUB_IMAGE_ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const

export type HubImageContentType = (typeof HUB_IMAGE_ALLOWED_TYPES)[number]

export const HUB_IMAGE_MAX_BYTES = 2 * 1024 * 1024

let cachedClient: SupabaseClient | null = null

function getServiceClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set for Supabase Storage')
  }
  if (!cachedClient) {
    cachedClient = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }
  return cachedClient
}

export function getSupabaseStorageBucket(): string {
  return process.env.SUPABASE_STORAGE_BUCKET?.trim() || 'thtwaat'
}

/** Object key: `thtwaat/{hubId}/{assetType}/{timestamp}_{filename}` */
export function hubAssetObjectPath(
  hubId: string,
  assetType: string,
  filename: string
): string {
  const base = filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) || 'image'
  return `thtwaat/${hubId}/${assetType}/${Date.now()}_${base}`
}

export async function createHubImageSignedUpload(input: {
  hubId: string
  assetType: 'hub' | 'bus' | 'transport' | 'truck'
  filename: string
  contentType: HubImageContentType
}): Promise<{ path: string; signedUrl: string; token: string; publicUrl: string }> {
  const bucket = getSupabaseStorageBucket()
  const path = hubAssetObjectPath(input.hubId, input.assetType, input.filename)
  const sb = getServiceClient()
  const { data, error } = await sb.storage
    .from(bucket)
    .createSignedUploadUrl(path, { upsert: true })
  if (error) throw error
  if (!data?.signedUrl || !data.token) {
    throw new Error('Supabase did not return a signed upload URL')
  }
  const { data: pub } = sb.storage.from(bucket).getPublicUrl(path)
  return {
    path,
    signedUrl: data.signedUrl,
    token: data.token,
    publicUrl: pub.publicUrl,
  }
}
