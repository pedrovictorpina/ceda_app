import { canTeachChildren } from '~/utils/authorization'

export default defineNuxtRouteMiddleware(async () => {
  if (import.meta.server) return

  const auth = useAuthStore()
  if (auth.loading) await auth.hydrate()
  if (!auth.profile) return navigateTo('/entrar')
  if (!canTeachChildren(auth.profile)) return navigateTo('/sementinhas')
})
