import { isPublicSessionRoute, safeAuthReturnTo } from '../utils/authFlow'

export default defineNuxtRouteMiddleware(async (to) => {
  // Browser/native storage is unavailable during SSR. Recovery exchanges its
  // own PKCE code before loading a profile and must keep control of that flow.
  if (import.meta.server || to.path === '/redefinir-senha') return
  // Public HTML first hydrates with the visitor state used by SSR. The root
  // repeats this navigation once Nuxt is ready, behind the startup screen.
  if (useNuxtApp().isHydrating && isPublicSessionRoute(to)) return

  const auth = useAuthStore()
  if (auth.loading) {
    try {
      await auth.hydrate()
    } catch {
      if (isPublicSessionRoute(to) || (import.meta.dev && to.path === '/design-system' && ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname))) return
      return navigateTo({ path: '/entrar', query: { next: safeAuthReturnTo(to.fullPath), motivo: 'verificar' } }, { replace: true })
    }
  }

  if (auth.profile && (to.path === '/' || to.path === '/entrar')) {
    return navigateTo(safeAuthReturnTo(to.query.next), { replace: true })
  }
})
