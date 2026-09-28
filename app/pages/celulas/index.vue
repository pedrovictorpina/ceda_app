<script setup lang="ts">
import type { CellDetailsFormValue } from '~/types/cells'
import { canManageChurch } from '~/utils/authorization'
import { cellErrorMessage } from '~/utils/cellDirectory'

definePageMeta({ middleware: 'cells' })
useSeoMeta({ title: 'Células' })

type CellsTab = 'mine' | 'find'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const toast = useToast()
const cellStore = useCellsStore()
const createOpen = ref(false)
const manager = computed(() => canManageChurch(auth.profile))
const tab = ref<CellsTab>(route.query.aba === 'encontrar' ? 'find' : 'mine')
const tabs = [
  { label: 'Minhas células', value: 'mine' },
  { label: 'Encontrar célula', value: 'find' }
]

watch(tab, (value) => {
  void router.replace({ query: { ...route.query, aba: value === 'find' ? 'encontrar' : undefined } })
})

onMounted(async () => {
  await cellStore.loadCells()
  // Quem ainda não participa de nenhuma célula começa pelo diretório.
  if (!route.query.aba && !cellStore.cells.length && !manager.value) tab.value = 'find'
})

async function createCell(payload: { details: CellDetailsFormValue, leaderEmails: string[] }) {
  try {
    await cellStore.createCell(payload)
    createOpen.value = false
    tab.value = 'mine'
    toast.add({ title: 'Célula criada', description: 'A liderança já pode editar os dados e o próprio perfil.', color: 'success', icon: 'i-lucide-circle-check' })
  } catch (caught) {
    toast.add({ title: 'Não deu certo', description: cellErrorMessage(caught, 'Não foi possível criar a célula.'), color: 'error', icon: 'i-lucide-circle-alert' })
  }
}
</script>

<template>
  <div>
    <BrandLoadingStatus
      v-if="cellStore.saving"
      label="Salvando célula…"
    />
    <PageIntro
      title="Células"
      description="Encontre uma célula perto de você, conheça os líderes e acompanhe comunicados e enquetes da sua."
      icon="i-lucide-house-heart"
    />

    <UAlert
      v-if="cellStore.demoMode"
      class="mb-5"
      color="warning"
      variant="subtle"
      title="Demonstração local"
      description="O Supabase não está configurado. Estes dados são fictícios, não concedem acesso e nenhuma ação é persistida."
    />
    <UAlert
      v-if="cellStore.errorMessage && tab === 'mine'"
      class="mb-5"
      color="error"
      variant="subtle"
      title="Não foi possível concluir"
      :description="cellStore.errorMessage"
    />

    <div class="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <UTabs
        v-model="tab"
        :items="tabs"
        :content="false"
        size="lg"
        class="w-full sm:w-auto"
        :ui="{ trigger: 'min-h-11 flex-1 sm:flex-none' }"
      />
      <UButton
        v-if="manager"
        icon="i-lucide-plus"
        label="Criar célula"
        class="min-h-11 justify-center rounded-full"
        @click="createOpen = true"
      />
    </div>

    <CellsMyCells
      v-if="tab === 'mine'"
      :manager="manager"
      @find="tab = 'find'"
    />
    <CellsDirectory v-else />

    <CellsDetailsForm
      v-if="manager"
      v-model:open="createOpen"
      mode="create"
      :saving="cellStore.saving"
      @submit="createCell"
    />
  </div>
</template>
