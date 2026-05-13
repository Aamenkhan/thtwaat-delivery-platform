'use client'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null = null

function getClient(): SupabaseClient {
  if (client) return client
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  if (!url || !key) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required')
  }
  client = createClient(url, key)
  return client
}

function getBucket(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET?.trim() || 'thtwaat'
}

export async function uploadOrderPhotoClient(input: {
  orderId: string
  file: File
  prefix: string
}): Promise<string> {
  const sb = getClient()
  const bucket = getBucket()
  const safe = input.file.name.replace(/[^a-zA-Z0-9._-]/g, '_') || 'photo.jpg'
  const path = `orders/${input.orderId}/${input.prefix}_${Date.now()}_${safe}`
  const { error } = await sb.storage.from(bucket).upload(path, input.file, {
    contentType: input.file.type || 'image/jpeg',
    upsert: true,
  })
  if (error) throw error
  const { data } = sb.storage.from(bucket).getPublicUrl(path)
  return data.publicUrl
}
