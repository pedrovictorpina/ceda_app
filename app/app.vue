<script setup lang="ts">
import { pt_br } from '@nuxt/ui/locale'
import { isPublicSessionRoute } from '~/utils/authFlow'
import { isOperationTabTransition } from '~/utils/navigation'

const { isLoading } = useLoadingIndicator()
const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const operationTabTransition = ref(false)
const removeNavigationGuard = router.beforeEach((to, from) => {
  operationTabTransition.value = isOperationTabTransition(from.path, to.path)
})
onBeforeUnmount(removeNavigationGuard)
watch(isLoading, (loading) => {
  if (!loading) operationTabTransition.value = false
})
// The entry branch stays stable even if the first guard redirects a private
// deep link to login. Public entries retain their server-rendered content.
const clientOnlyEntry = useState('auth:client-only-entry', () => !isPublicSessionRoute(route))
const mounted = ref(false)
const checkingSession = computed(() => !mounted.value || (auth.loading && route.path !== '/redefinir-senha'))
const showSessionError = computed(() => auth.sessionError && isPublicSessionRoute(route) && !['/entrar', '/redefinir-senha'].includes(route.path))

onNuxtReady(async () => {
  try {
    if (auth.loading && route.path !== '/redefinir-senha') {
      await router.replace({ ...router.currentRoute.value, force: true })
    }
  } finally {
    mounted.value = true
  }
})

async function retrySession() {
  try {
    await auth.hydrate()
    await router.replace({ ...router.currentRoute.value, force: true })
  } catch {
    // The store retains a safe message and releases the loading screen.
  }
}

useHead({
  htmlAttrs: { lang: 'pt-BR' },
  link: [
    { rel: 'icon', type: 'image/png', sizes: '192x192', href: '/icons/ceda-192.png' },
    { rel: 'apple-touch-icon', type: 'image/png', sizes: '180x180', href: '/icons/ceda-apple-180.png' }
  ]
})
</script>

<template>
  <UApp :locale="pt_br">
    <BrandLoadingScreen
      v-if="checkingSession || (isLoading && !operationTabTransition)"
      :label="checkingSession ? 'Verificando seu acesso…' : 'Abrindo página…'"
    />
    <div
      :inert="checkingSession || undefined"
      :aria-busy="checkingSession || undefined"
    >
      <UAlert
        v-if="showSessionError"
        class="mx-auto my-4 max-w-6xl"
        color="warning"
        title="Não foi possível verificar seu acesso"
        :description="auth.sessionError"
        :actions="[{ label: 'Tentar novamente', onClick: retrySession }]"
      />
      <ClientOnly v-if="clientOnlyEntry">
        <NuxtLayout>
          <NuxtPage />
        </NuxtLayout>
      </ClientOnly>
      <NuxtLayout v-else>
        <NuxtPage />
      </NuxtLayout>
    </div>
    <ClientOnly>
      <AppUpdateNotice />
    </ClientOnly>
  </UApp>
</template>
