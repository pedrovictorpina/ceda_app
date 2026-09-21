import { canAccessChildren } from '~/utils/authorization'

export default defineNuxtRouteMiddleware(async () => {
  if (import.meta.server) return

  const auth = useAuthStore()
  if (auth.loading) await auth.hydrate()
  if (!auth.profile) return navigateTo('/entrar')
  if (!canAccessChildren(auth.profile)) return navigateTo('/inicio')
})
