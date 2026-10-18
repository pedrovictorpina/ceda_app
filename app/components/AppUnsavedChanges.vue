<script setup lang="ts">
const props = defineProps<{ dirty: boolean }>()
const open = ref(false)
const destination = ref('')
const leaving = ref(false)
const leaveError = ref('')
let confirmed = false
onBeforeRouteLeave((to) => {
  if (!props.dirty || confirmed) return true
  destination.value = to.fullPath
  open.value = true
  return false
})
function beforeUnload(event: BeforeUnloadEvent) {
  if (!props.dirty || confirmed) return
  event.preventDefault()
  event.returnValue = ''
}
async function leave() {
  if (leaving.value || !destination.value) return
  leaving.value = true
  leaveError.value = ''
  confirmed = true
  try {
    const result = await navigateTo(destination.value)
    if (!result) open.value = false
  } catch {
    leaveError.value = 'Não foi possível abrir a página. Seu texto continua aqui; tente novamente.'
  } finally {
    // Another guard can cancel this navigation. Ask again on the next attempt.
    confirmed = false
    leaving.value = false
  }
}
watch(() => props.dirty, (dirty) => {
  if (!dirty) open.value = false
})
onMounted(() => window.addEventListener('beforeunload', beforeUnload))
onBeforeUnmount(() => window.removeEventListener('beforeunload', beforeUnload))
</script>

<template>
  <UModal
    v-model:open="open"
    title="Sair sem salvar?"
    description="Há um texto em andamento. Se você sair desta página, ele será descartado."
    :dismissible="!leaving"
  >
    <template #body>
      <UAlert
        v-if="leaveError"
        class="mb-4"
        color="error"
        :description="leaveError"
      />
      <div class="flex flex-wrap justify-end gap-3">
        <UButton
          label="Continuar escrevendo"
          color="neutral"
          variant="outline"
          :disabled="leaving"
          @click="open = false"
        />
        <UButton
          label="Descartar e sair"
          color="error"
          :loading="leaving"
          @click="leave"
        />
      </div>
    </template>
  </UModal>
</template>
