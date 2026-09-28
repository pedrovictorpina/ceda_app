import { CHILD_PHOTO_BUCKET, CHILD_PHOTO_SIGNED_URL_SECONDS, childPhotoPath, validateChildPhoto } from '~/utils/childPhoto'

interface SignedPhoto {
  url: string
  expiresAt: number
}

// Renew a signed URL a little before it expires so an open card never breaks.
const RENEW_MARGIN_MS = 5 * 60 * 1000

/** Fotos das crianças ficam em bucket privado e são lidas por URL assinada. */
export function useChildPhotos() {
  const signed = useState<Record<string, SignedPhoto>>('child-photo-urls', () => ({}))

  async function resolvePhotos(paths: ReadonlyArray<string | null | undefined>) {
    const { $supabase } = useNuxtApp()
    if (!$supabase) return
    const now = Date.now()
    const missing = [...new Set(paths.filter((path): path is string => Boolean(path)))]
      .filter(path => (signed.value[path]?.expiresAt ?? 0) - RENEW_MARGIN_MS < now)
    if (!missing.length) return

    const { data, error } = await $supabase.storage.from(CHILD_PHOTO_BUCKET).createSignedUrls(missing, CHILD_PHOTO_SIGNED_URL_SECONDS)
    if (error || !data) return
    const expiresAt = now + CHILD_PHOTO_SIGNED_URL_SECONDS * 1000
    const fresh = Object.fromEntries(data
      .filter(item => item.path && item.signedUrl && !item.error)
      .map(item => [item.path as string, { url: item.signedUrl, expiresAt }]))
    signed.value = { ...signed.value, ...fresh }
  }

  function photoUrl(path: string | null | undefined) {
    return path ? signed.value[path]?.url ?? '' : ''
  }

  async function uploadPhoto(childId: string, file: File): Promise<string> {
    const { $supabase } = useNuxtApp()
    if (!$supabase) throw new Error('O serviço de dados não está configurado.')
    const problem = validateChildPhoto(file)
    if (problem) throw new Error(problem)
    const path = childPhotoPath(childId, file.type, crypto.randomUUID())
    const { error } = await $supabase.storage.from(CHILD_PHOTO_BUCKET).upload(path, file, {
      contentType: file.type,
      cacheControl: '3600',
      upsert: false
    })
    if (error) throw new Error('Não foi possível enviar a foto. Verifique a conexão e tente novamente.')
    return path
  }

  async function removePhoto(path: string | null | undefined) {
    const { $supabase } = useNuxtApp()
    if (!path || !$supabase) return
    await $supabase.storage.from(CHILD_PHOTO_BUCKET).remove([path])
    signed.value = Object.fromEntries(Object.entries(signed.value).filter(([key]) => key !== path))
  }

  return { resolvePhotos, photoUrl, uploadPhoto, removePhoto }
}
