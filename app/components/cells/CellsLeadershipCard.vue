<script setup lang="ts">
import { cellErrorMessage } from '~/utils/cellDirectory'

const props = defineProps<{ cellId: string }>()

const toast = useToast()
const cellStore = useCellsStore()
const email = ref('')

async function assign() {
  if (!email.value.trim()) return
  try {
    await cellStore.assignLeader(props.cellId, email.value)
    email.value = ''
    toast.add({ title: 'Liderança atribuída', color: 'success', icon: 'i-lucide-circle-check' })
  } catch (caught) {
    toast.add({ title: 'Não deu certo', description: cellErrorMessage(caught, 'Não foi possível atribuir a liderança.'), color: 'error', icon: 'i-lucide-circle-alert' })
  }
}
</script>

<template>
  <UCard :ui="{ root: 'rounded-2xl' }">
    <template #header>
      <h2 class="font-semibold">
        Atribuir liderança
      </h2>
      <p class="mt-1 text-xs text-muted">
        Somente administradores e pastores atribuem ou removem líderes.
      </p>
    </template>
    <form
      class="flex gap-2"
      @submit.prevent="assign"
    >
      <UInput
        v-model="email"
        type="email"
        size="xl"
        placeholder="lider@exemplo.com"
        aria-label="E-mail do novo líder"
        class="min-w-0 flex-1"
      />
      <UButton
        type="submit"
        size="xl"
        :disabled="cellStore.demoMode || !email.trim()"
        label="Atribuir"
      />
    </form>
  </UCard>
</template>
