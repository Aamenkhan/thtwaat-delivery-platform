import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let cachedClient: SupabaseClient | null = null

function getServiceClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set')
  }
  if (!cachedClient) {
    cachedClient = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }
  return cachedClient
}

function getBucket(): string {
  return process.env.SUPABASE_STORAGE_BUCKET?.trim() || 'thtwaat'
}

export async function uploadWorkerAsset(input: {
  workerId: string
  type:
    | 'profile'
    | 'aadhaar'
    | 'aadhaar_back'
    | 'pan_front'
    | 'pan_back'
    | 'vehicle_front'
    | 'vehicle_back'
    | 'license'
  filename: string
  buffer: Buffer
  contentType: string
}): Promise<string> {
  const safeName =
    input.filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) || 'image.jpg'
  const path = `workers/${input.workerId}/${input.type}/${Date.now()}_${safeName}`
  const sb = getServiceClient()
  const bucket = getBucket()
  const { error } = await sb.storage.from(bucket).upload(path, input.buffer, {
    contentType: input.contentType,
    upsert: true,
  })
  if (error) throw error
  const { data } = sb.storage.from(bucket).getPublicUrl(path)
  return data.publicUrl
}
