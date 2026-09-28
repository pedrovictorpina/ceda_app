<script setup lang="ts">
import type { CellMemberCandidate } from '~/types/cells'
import { cellErrorMessage, MEMBER_SEARCH_MIN } from '~/utils/cellDirectory'

const props = defineProps<{ cellId: string, disabled?: boolean }>()

const SEARCH_DEBOUNCE_MS = 300
const toast = useToast()
const cellStore = useCellsStore()
const memberSearch = useCellMemberSearch()
const { results, lastQuery, searching, error } = memberSearch
const { avatarUrl } = useAvatarUrls()
const query = ref('')
const addingId = ref('')
const tooShort = computed(() => query.value.trim().length > 0 && query.value.trim().length < MEMBER_SEARCH_MIN)
let timer: ReturnType<typeof setTimeout> | undefined

watch(query, (value) => {
  if (timer) clearTimeout(timer)
  if (value.trim().length < MEMBER_SEARCH_MIN) {
    memberSearch.clear()
    return
  }
  timer = setTimeout(() => memberSearch.search(props.cellId, value), SEARCH_DEBOUNCE_MS)
})
onUnmounted(() => timer && clearTimeout(timer))

async function add(person: CellMemberCandidate) {
  addingId.value = person.id
  try {
    await cellStore.addMember(props.cellId, person.id)
    toast.add({ title: `${person.name.split(' ')[0]} foi adicionado(a) à célula`, color: 'success', icon: 'i-lucide-circle-check' })
    results.value = results.value.filter(item => item.id !== person.id)
  } catch (caught) {
    toast.add({ title: 'Não deu certo', description: cellErrorMessage(caught, 'Não foi possível adicionar à célula.'), color: 'error', icon: 'i-lucide-circle-alert' })
  } finally {
    addingId.value = ''
  }
}
</script>

<template>
  <div>
    <UInput
      v-model="query"
      icon="i-lucide-user-search"
      size="xl"
      class="w-full"
      placeholder="Buscar pessoa pelo nome"
      aria-label="Buscar pessoa para adicionar"
      maxlength="60"
      :loading="searching"
      :disabled="disabled"
    />
    <p
      v-if="tooShort"
      class="mt-1 text-xs text-muted"
    >
      Digite pelo menos {{ MEMBER_SEARCH_MIN }} letras.
    </p>
    <p
      v-if="error"
      class="mt-1 text-xs text-error"
    >
      {{ error }}
    </p>
    <ul
      v-if="results.length"
      class="mt-2 divide-y divide-default rounded-2xl border border-default"
    >
      <li
        v-for="person in results"
        :key="person.id"
        class="flex items-center gap-3 p-2"
      >
        <UAvatar
          :src="avatarUrl(person.avatarPath)"
          :alt="person.name"
        />
        <span class="min-w-0 flex-1 truncate text-sm font-medium">{{ person.name }}</span>
        <UButton
          size="sm"
          icon="i-lucide-user-plus"
          label="Adicionar"
          class="min-h-11"
          :loading="addingId === person.id"
          @click="add(person)"
        />
      </li>
    </ul>
    <p
      v-else-if="!searching && lastQuery && lastQuery === query.trim() && !error"
      class="mt-2 text-xs text-muted"
    >
      Ninguém encontrado fora da célula com esse nome.
    </p>
  </div>
</template>
