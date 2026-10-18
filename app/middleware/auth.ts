import { safeAuthReturnTo } from '~/utils/authFlow'

export default defineNuxtRouteMiddleware(async (to) => {
  // Browser storage is the source of the Supabase session. During SSR it is
  // unavailable, so let the client hydrate before deciding whether to redirect.
  if (import.meta.server) return

  const auth = useAuthStore()
  if (auth.loading) {
    try {
      await auth.hydrate()
    } catch {
      return navigateTo({ path: '/entrar', query: { next: safeAuthReturnTo(to.fullPath), motivo: 'verificar' } })
    }
  }
  if (!auth.profile) return navigateTo({ path: '/entrar', query: { next: safeAuthReturnTo(to.fullPath) } })
})
