export default defineNuxtRouteMiddleware(async () => {
  if (import.meta.server) return

  const auth = useAuthStore()
  if (auth.loading) await auth.hydrate()
  if (auth.configured && !auth.profile) return navigateTo('/entrar')
})
