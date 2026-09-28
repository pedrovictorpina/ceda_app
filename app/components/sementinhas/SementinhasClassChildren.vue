<script setup lang="ts">
import type { ChildRecord } from '~/types/children'
import type { ManagedClass } from '~/composables/useChildrenClasses'
import { ageInYears, formatAgeRange, formatChildAge, isAgeInRange } from '~/utils/childAge'

const SEARCH_DELAY_MS = 300

const props = defineProps<{
  item: ManagedClass
  photoUrl: (path: string | null) => string
  search: (term: string) => Promise<{ results: ChildRecord[], error: string }>
  busyChildId: string
}>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ enroll: [child: ChildRecord], unenroll: [child: ChildRecord] }>()

const term = ref('')
const results = ref<ChildRecord[]>([])
const searching = ref(false)
const searchError = ref('')
let searchTimer: ReturnType<typeof setTimeout> | undefined
let searchRun = 0

const enrolledIds = computed(() => new Set(props.item.children.map(child => child.id)))
const candidates = computed(() => results.value.filter(child => !enrolledIds.value.has(child.id)))

function outOfRange(child: ChildRecord) {
  const age = ageInYears(child.birth_date)
  return age !== null && !isAgeInRange(age, props.item.min_age, props.item.max_age)
}

watch(term, (value) => {
  if (searchTimer) clearTimeout(searchTimer)
  searchError.value = ''
  if (value.trim().length < 2) {
    results.value = []
    searching.value = false
    return
  }
  searching.value = true
  searchTimer = setTimeout(async () => {
    const run = ++searchRun
    const response = await props.search(value)
    if (run !== searchRun) return
    results.value = response.results
    searchError.value = response.error
    searching.value = false
  }, SEARCH_DELAY_MS)
})

watch(open, (isOpen) => {
  if (isOpen) return
  term.value = ''
  results.value = []
})

onUnmounted(() => {
  if (searchTimer) clearTimeout(searchTimer)
})
</script>

<template>
  <UDrawer
    v-model:open="open"
    :title="`Crianças da turma ${item.name}`"
    :description="`Faixa: ${formatAgeRange(item.min_age, item.max_age)}. Busque pelo nome para adicionar.`"
    :ui="{ content: 'max-h-[92dvh]', body: 'overflow-y-auto', footer: 'safe-bottom' }"
  >
    <template #body>
      <div class="mx-auto w-full max-w-lg space-y-5">
        <div>
          <UInput
            v-model="term"
            class="w-full"
            size="xl"
            icon="i-lucide-search"
            placeholder="Nome da criança"
            aria-label="Buscar criança pelo nome"
            :loading="searching"
            :ui="{ base: 'rounded-full' }"
          />
          <p
            v-if="searchError"
            class="mt-2 text-sm text-error"
          >
            {{ searchError }}
          </p>
          <ul
            v-if="candidates.length"
            class="mt-3 space-y-2"
          >
            <li
              v-for="child in candidates"
              :key="child.id"
              class="flex items-center gap-3 rounded-2xl border border-default p-2.5"
            >
              <SementinhasChildAvatar
                :name="child.full_name"
                :url="photoUrl(child.photo_path)"
                size="sm"
              />
              <div class="min-w-0 flex-1">
                <p class="truncate font-semibold">
                  {{ child.full_name }}
                </p>
                <p class="text-sm text-muted">
                  {{ formatChildAge(child.birth_date) }}
                </p>
                <p
                  v-if="outOfRange(child)"
                  class="flex items-center gap-1 text-xs font-medium text-warning"
                >
                  <UIcon
                    name="i-lucide-triangle-alert"
                    class="size-3.5"
                  />
                  Fora da faixa da turma
                </p>
              </div>
              <UButton
                icon="i-lucide-plus"
                label="Adicionar"
                class="min-h-11 rounded-full"
                :loading="busyChildId === child.id"
                :disabled="Boolean(busyChildId)"
                @click="emit('enroll', child)"
              />
            </li>
          </ul>
          <p
            v-else-if="term.trim().length >= 2 && !searching && !searchError"
            class="mt-3 text-sm text-muted"
          >
            Nenhuma criança nova encontrada com “{{ term.trim() }}”. Os responsáveis cadastram os filhos no Sementinhas.
          </p>
        </div>

        <section aria-labelledby="enrolled-title">
          <h3
            id="enrolled-title"
            class="mb-2 font-semibold"
          >
            Na turma ({{ item.children.length }})
          </h3>
          <ul
            v-if="item.children.length"
            class="divide-y divide-default rounded-2xl border border-default"
          >
            <li
              v-for="child in item.children"
              :key="child.id"
              class="flex items-center gap-3 p-2.5"
            >
              <SementinhasChildAvatar
                :name="child.full_name"
                :url="photoUrl(child.photo_path)"
                size="sm"
              />
              <div class="min-w-0 flex-1">
                <p class="truncate font-medium">
                  {{ child.full_name }}
                </p>
                <p
                  class="text-sm"
                  :class="outOfRange(child) ? 'text-warning' : 'text-muted'"
                >
                  {{ formatChildAge(child.birth_date) }}<template v-if="outOfRange(child)">
                    · fora da faixa
                  </template>
                </p>
              </div>
              <UButton
                color="neutral"
                variant="ghost"
                icon="i-lucide-user-minus"
                class="size-11 justify-center rounded-full"
                :aria-label="`Retirar ${child.full_name} da turma`"
                :loading="busyChildId === child.id"
                :disabled="Boolean(busyChildId)"
                @click="emit('unenroll', child)"
              />
            </li>
          </ul>
          <p
            v-else
            class="rounded-2xl border border-dashed border-default p-4 text-sm text-muted"
          >
            Nenhuma criança nesta turma ainda.
          </p>
        </section>
      </div>
    </template>
  </UDrawer>
</template>
