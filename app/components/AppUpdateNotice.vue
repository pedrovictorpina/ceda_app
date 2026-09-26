<script setup lang="ts">
import { useRegisterSW } from 'virtual:pwa-register/vue'

const { needRefresh, updateServiceWorker } = useRegisterSW()
const updating = ref(false)

async function applyUpdate() {
  updating.value = true
  try {
    await updateServiceWorker()
  } finally {
    updating.value = false
  }
}
</script>

<template>
  <div
    v-if="needRefresh"
    class="fixed inset-x-4 bottom-4 z-[100] mx-auto max-w-md"
    role="status"
    aria-live="polite"
  >
    <BrandLoadingScreen
      v-if="updating"
      label="Atualizando aplicativo…"
    />
    <UCard class="border-primary/40 shadow-xl">
      <div class="flex items-start gap-3">
        <UIcon
          name="i-lucide-refresh-cw"
          class="mt-0.5 size-5 shrink-0 text-primary"
        />
        <div class="min-w-0 flex-1">
          <p class="font-semibold">
            Uma nova versão está disponível
          </p>
          <p class="mt-1 text-sm text-muted">
            Atualize quando for melhor para você. Sua sessão continuará ativa.
          </p>
        </div>
      </div>
      <template #footer>
        <UButton
          block
          :loading="updating"
          label="Atualizar agora"
          icon="i-lucide-refresh-cw"
          @click="applyUpdate"
        />
      </template>
    </UCard>
  </div>
</template>
