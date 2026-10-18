import { clearOtherStoreCartDrafts } from '~/utils/storeCartDraft'

export default defineNuxtPlugin(() => {
  const auth = useAuthStore()
  watch(() => [auth.profile?.id, auth.loading] as const, ([ownerId, loading]) => {
    if (loading) return
    try {
      clearOtherStoreCartDrafts(window.sessionStorage, ownerId || null)
    } catch { /* Armazenamento indisponível. */ }
  }, { immediate: true, flush: 'sync' })
})
