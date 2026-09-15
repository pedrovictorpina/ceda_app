export default defineNuxtRouteMiddleware(async () => {
  const auth = useAuthStore()
  if (auth.loading) await auth.hydrate()
  if (auth.configured && !auth.profile) return navigateTo('/entrar')
})
