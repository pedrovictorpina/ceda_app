<script setup lang="ts">
import { authFlowLink } from '~/utils/authFlow'

const route = useRoute()
const visitorLinks = [
  { label: 'Planejar visita', to: '/horarios-de-culto' },
  { label: 'Contato', to: '/contato' },
  { label: 'Sobre nós', to: '/sobre' }
]
</script>

<template>
  <div class="min-h-screen bg-default text-default">
    <header class="sticky top-0 z-40 border-b border-default bg-default/95 backdrop-blur">
      <div class="mx-auto flex min-h-16 max-w-6xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-2">
        <BrandLogo />
        <div class="order-3 flex w-full gap-1 overflow-x-auto pb-1 sm:order-none sm:w-auto sm:flex-1 sm:pb-0">
          <UNavigationMenu
            :items="visitorLinks"
            aria-label="Informações para visitantes"
            :ui="{ link: 'min-h-11 whitespace-nowrap' }"
          />
        </div>
        <div class="ml-auto flex items-center gap-2">
          <UColorModeButton /><UButton
            :to="authFlowLink('/entrar', route.query.next)"
            label="Entrar"
          />
        </div>
      </div>
    </header>
    <main><slot /></main>
  </div>
</template>
