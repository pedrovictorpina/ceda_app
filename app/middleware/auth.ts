export default defineNuxtRouteMiddleware(async () => {
  const auth = useAuthStore()
  if (auth.loading) await auth.hydrate()
  if (!auth.profile) return navigateTo('/entrar')
})
