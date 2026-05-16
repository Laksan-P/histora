import { supabase } from './supabaseClient'

/**
 * Helpers around the `avatars` Supabase Storage bucket. The bucket is
 * configured public-read (so the URL works directly inside <img> tags)
 * with per-user write policies — see migration `0004_profiles_extended.sql`.
 *
 * All file paths follow the convention:
 *
 *     <auth.uid()>/<filename>
 *
 * which matches the storage RLS check
 * `auth.uid()::text = (storage.foldername(name))[1]`.
 */

const BUCKET = 'avatars'
const MAX_BYTES = 4 * 1024 * 1024 // 4 MB
const ALLOWED_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
])

export type AvatarUploadResult =
  | { ok: true; publicUrl: string; path: string }
  | { ok: false; error: string }

export function isAvatarStorageAvailable(): boolean {
  return supabase !== null
}

function extensionFor(file: File): string {
  const fromName = file.name.split('.').pop()
  if (fromName && fromName.length <= 5) return fromName.toLowerCase()
  if (file.type === 'image/png') return 'png'
  if (file.type === 'image/jpeg') return 'jpg'
  if (file.type === 'image/webp') return 'webp'
  if (file.type === 'image/gif') return 'gif'
  return 'bin'
}

/**
 * Upload (or replace) the user's avatar. Returns the public URL on
 * success so the caller can stash it on `profiles.avatar_url`.
 */
export async function uploadAvatar(
  userId: string,
  file: File,
): Promise<AvatarUploadResult> {
  if (!supabase) {
    return { ok: false, error: 'Storage is not configured.' }
  }
  if (!file) {
    return { ok: false, error: 'No file selected.' }
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, error: 'Image is larger than 4 MB.' }
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return {
      ok: false,
      error: 'Use a PNG, JPG, WEBP, or GIF image.',
    }
  }

  // Cache-bust filename so the new image surfaces immediately even
  // though we always upsert into the same bucket. Folder is `<uid>/…`
  // so the storage RLS check matches.
  const ext = extensionFor(file)
  const path = `${userId}/avatar-${Date.now()}.${ext}`

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: true,
      contentType: file.type,
    })

  if (error) {
    return { ok: false, error: error.message }
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  if (!data?.publicUrl) {
    return { ok: false, error: 'Could not resolve avatar URL.' }
  }
  return { ok: true, publicUrl: data.publicUrl, path }
}
