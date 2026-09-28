<script setup lang="ts">
import type { CellDirectoryEntry, CellDirectoryFilters, CellVisitFormValue } from '~/types/cells'
import { filterCellDirectory } from '~/utils/cellDirectory'

const auth = useAuthStore()
const toast = useToast()
const directory = useCellDirectory()
const { entries, loading, sending, error, demo } = directory
const filters = ref<CellDirectoryFilters>({ weekday: null, search: '' })
const selectedId = ref('')
const leadersOpen = ref(false)
const visitOpen = ref(false)

const visible = computed(() => filterCellDirectory(entries.value, filters.value))
const selected = computed<CellDirectoryEntry | undefined>(() => entries.value.find(entry => entry.id === selectedId.value))
const requesterName = computed(() => auth.profile?.name ?? '')
const filtering = computed(() => filters.value.weekday !== null || Boolean(filters.value.search.trim()))

onMounted(() => directory.load())

function showLeaders(entry: CellDirectoryEntry) {
  selectedId.value = entry.id
  leadersOpen.value = true
}

function showVisit(entry: CellDirectoryEntry) {
  selectedId.value = entry.id
  error.value = ''
  visitOpen.value = true
}

async function submitVisit(form: CellVisitFormValue) {
  if (!selected.value) return false
  const ok = await directory.requestVisit(selected.value.id, form)
  if (ok) toast.add({ title: 'Pedido enviado', description: 'A liderança foi avisada no app.', color: 'success', icon: 'i-lucide-circle-check' })
  return ok
}

async function cancelVisit() {
  const visit = selected.value?.myVisitRequest
  if (!selected.value || !visit) return false
  const ok = await directory.cancelVisit(selected.value.id, visit.id)
  if (ok) {
    visitOpen.value = false
    toast.add({ title: 'Pedido cancelado', color: 'neutral', icon: 'i-lucide-info' })
  }
  return ok
}

function clearFilters() {
  filters.value = { weekday: null, search: '' }
}
</script>

<template>
  <section aria-labelledby="directory-title">
    <h2
      id="directory-title"
      class="sr-only"
    >
      Encontrar uma célula
    </h2>
    <UAlert
      v-if="demo"
      class="mb-4"
      color="warning"
      variant="subtle"
      title="Demonstração local"
      description="Células fictícias. Pedidos de visita não são enviados sem Supabase."
    />
    <CellsDirectoryFilters
      v-model="filters"
      class="mb-5"
    />
    <UAlert
      v-if="error && !visitOpen"
      class="mb-4"
      color="error"
      variant="subtle"
      title="Não foi possível concluir"
      :description="error"
    />

    <div
      v-if="loading"
      class="py-12 text-center text-muted"
    >
      <BrandLoader label="Carregando células…" />
    </div>
    <div
      v-else-if="!visible.length"
      class="rounded-2xl border border-dashed border-default px-4 py-12 text-center"
    >
      <UIcon
        name="i-lucide-search-x"
        class="mx-auto size-10 text-muted"
      />
      <p class="mt-3 font-semibold">
        {{ filtering ? 'Nenhuma célula encontrada' : 'Ainda não há células abertas' }}
      </p>
      <p class="mx-auto mt-1 max-w-md text-sm text-muted">
        {{ filtering ? 'Tente outro dia da semana ou outro bairro.' : 'Quando a igreja cadastrar células, elas aparecerão aqui.' }}
      </p>
      <UButton
        v-if="filtering"
        class="mt-4 min-h-11"
        color="neutral"
        variant="soft"
        label="Limpar filtros"
        @click="clearFilters"
      />
    </div>
    <div
      v-else
      class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
    >
      <CellsDirectoryCard
        v-for="entry in visible"
        :key="entry.id"
        :entry="entry"
        @leaders="showLeaders(entry)"
        @visit="showVisit(entry)"
      />
    </div>

    <CellsLeadersModal
      v-if="selected"
      v-model:open="leadersOpen"
      :leaders="selected.leaders"
      :cell-name="selected.name"
      :requester-name="requesterName"
    />
    <CellsVisitDrawer
      v-model:open="visitOpen"
      :entry="selected"
      :requester-name="requesterName"
      :sending="sending"
      :error="error"
      :submit="submitVisit"
      :cancel="cancelVisit"
    />
  </section>
</template>
