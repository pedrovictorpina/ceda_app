import { canManageChurch, hasRole } from '~/utils/authorization'

export default defineNuxtRouteMiddleware(async () => {
  if (import.meta.server) return

  const auth = useAuthStore()
  if (auth.loading) await auth.hydrate()
  if (!auth.profile) return navigateTo('/entrar')
  if (!canManageChurch(auth.profile) && !hasRole(auth.profile, 'cashier')) return navigateTo('/operacao')
})
