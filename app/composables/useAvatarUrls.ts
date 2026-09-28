const AVATAR_BUCKET = 'avatars'
const AVATAR_URL_TTL_SECONDS = 60 * 60

/**
 * URLs assinadas das fotos de perfil (bucket privado "avatars"), em cache por
 * caminho. Falhas de assinatura são ignoradas: a interface mostra as iniciais.
 */
export function useAvatarUrls() {
  const urls = useState<Record<string, string>>('avatar-signed-urls', () => ({}))

  async function resolveAvatars(paths: ReadonlyArray<string | null | undefined>) {
    const { $supabase } = useNuxtApp()
    const missing = [...new Set(paths.filter((path): path is string => Boolean(path)))].filter(path => !urls.value[path])
    if (!$supabase || !missing.length) return
    try {
      const { data, error } = await $supabase.storage.from(AVATAR_BUCKET).createSignedUrls(missing, AVATAR_URL_TTL_SECONDS)
      if (error || !data) return
      const fresh = Object.fromEntries(data.flatMap(item => item.path && item.signedUrl && !item.error ? [[item.path, item.signedUrl]] : []))
      urls.value = { ...urls.value, ...fresh }
    } catch {
      // Fotos são opcionais.
    }
  }

  function avatarUrl(path: string | null | undefined): string | undefined {
    return path ? urls.value[path] : undefined
  }

  return { resolveAvatars, avatarUrl }
}
