export default defineNuxtRouteMiddleware(async () => {
  // Browser storage is the source of the Supabase session. During SSR it is
  // unavailable, so let the client hydrate before deciding whether to redirect.
  if (import.meta.server) return

  const auth = useAuthStore()
  if (auth.loading) await auth.hydrate()
  if (!auth.profile) return navigateTo('/entrar')
})
