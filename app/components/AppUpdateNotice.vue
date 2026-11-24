<script setup lang="ts">
import { useRegisterSW } from 'virtual:pwa-register/vue'
import { ref } from 'vue'

const { needRefresh, updateServiceWorker } = useRegisterSW()
const updating = ref(false)
const postponed = ref(false)

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
  <UModal
    :open="needRefresh && !postponed"
    title="Uma nova versão está disponível"
    description="Atualize quando for melhor para você. Sua sessão continuará ativa."
    :dismissible="!updating"
    :close="!updating"
    :ui="{ overlay: 'backdrop-blur-sm' }"
    @update:open="postponed = !$event"
  >
    <template #footer>
      <div class="flex w-full flex-wrap justify-end gap-2">
        <UButton
          color="neutral"
          variant="outline"
          label="Agora não"
          :disabled="updating"
          @click="postponed = true"
        />
        <UButton
          :loading="updating"
          label="Atualizar agora"
          icon="i-lucide-refresh-cw"
          @click="applyUpdate"
        />
      </div>
    </template>
  </UModal>
  <UButton
    v-if="needRefresh && postponed"
    class="fixed bottom-20 right-4 z-50 shadow-lg md:bottom-4"
    label="Atualização disponível"
    icon="i-lucide-refresh-cw"
    @click="postponed = false"
  />
  <BrandLoadingScreen
    v-if="updating"
    label="Atualizando aplicativo…"
  />
</template>
