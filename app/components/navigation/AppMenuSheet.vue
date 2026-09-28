<script setup lang="ts">
import type { NavigationItem } from '~/types/domain'
import { searchNavigation, type SearchableEntry } from '~/utils/navigation'

export interface MenuGroup {
  id: string
  label: string
  items: NavigationItem[]
}

const props = defineProps<{
  groups: MenuGroup[]
  searchIndex: SearchableEntry[]
  recent: SearchableEntry[]
  activeTo?: string
  canUseAdminView: boolean
  isAdminView: boolean
}>()
const emit = defineEmits<{ changeView: [], signOut: [] }>()
const open = defineModel<boolean>('open', { required: true })

const search = ref('')
const results = computed(() => searchNavigation(props.searchIndex, search.value))

function close() {
  open.value = false
}

watch(open, (isOpen) => {
  if (!isOpen) search.value = ''
})
</script>

<template>
  <UDrawer
    v-model:open="open"
    title="Menu"
    :description="isAdminView ? 'Visão administrador' : 'Tudo o que você pode acessar no app'"
    :ui="{ content: 'max-h-[90dvh] md:hidden', body: 'overflow-y-auto', footer: 'safe-bottom border-t border-default' }"
  >
    <template #body>
      <UInput
        v-model="search"
        class="w-full"
        size="xl"
        icon="i-lucide-search"
        placeholder="Buscar no menu"
        aria-label="Buscar no menu"
        :ui="{ base: 'rounded-full' }"
      />

      <div
        v-if="search.trim()"
        class="mt-4"
      >
        <ul
          v-if="results.length"
          class="space-y-1"
        >
          <li
            v-for="entry in results"
            :key="entry.to"
          >
            <NuxtLink
              :to="entry.to"
              class="focus-ring flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-medium hover:bg-elevated"
              @click="close"
            >
              <UIcon
                :name="entry.icon"
                class="size-5 text-primary"
              />
              <span class="flex-1">{{ entry.label }}</span>
              <span
                v-if="entry.context"
                class="text-xs text-muted"
              >{{ entry.context }}</span>
            </NuxtLink>
          </li>
        </ul>
        <p
          v-else
          class="py-8 text-center text-sm text-muted"
        >
          Nada encontrado para “{{ search.trim() }}”. Tente outra palavra.
        </p>
      </div>

      <template v-else>
        <section
          v-if="recent.length"
          class="mt-5"
          aria-labelledby="menu-recentes"
        >
          <h3
            id="menu-recentes"
            class="mb-2 text-sm font-semibold text-muted"
          >
            Usados recentemente
          </h3>
          <div class="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
            <NuxtLink
              v-for="entry in recent"
              :key="entry.to"
              :to="entry.to"
              class="focus-ring flex min-h-10 shrink-0 items-center gap-2 rounded-full border border-default px-3 text-sm font-medium hover:bg-elevated"
              @click="close"
            >
              <UIcon
                :name="entry.icon"
                class="size-4 text-primary"
              />
              {{ entry.label }}
            </NuxtLink>
          </div>
        </section>

        <section
          v-for="group in groups"
          :key="group.id"
          class="mt-5"
          :aria-labelledby="`menu-${group.id}`"
        >
          <h3
            :id="`menu-${group.id}`"
            class="mb-2 text-sm font-semibold text-muted"
          >
            {{ group.label }}
          </h3>
          <ul class="grid grid-cols-3 gap-2">
            <li
              v-for="item in group.items"
              :key="item.to"
            >
              <NuxtLink
                :to="item.to"
                class="focus-ring flex h-full min-h-24 flex-col items-center justify-center gap-2 rounded-2xl border p-2 text-center text-xs font-medium leading-tight transition"
                :class="item.to === activeTo ? 'border-primary/40 bg-primary/10 text-primary' : 'border-default bg-elevated/40 text-default hover:bg-elevated'"
                :aria-current="item.to === activeTo ? 'page' : undefined"
                @click="close"
              >
                <span
                  class="grid size-10 place-items-center rounded-xl"
                  :class="item.to === activeTo ? 'bg-primary text-white' : 'bg-primary/10 text-primary'"
                >
                  <UIcon
                    :name="item.icon"
                    class="size-5"
                  />
                </span>
                {{ item.label }}
              </NuxtLink>
            </li>
          </ul>
        </section>
      </template>
    </template>

    <template #footer>
      <div class="flex gap-2">
        <UButton
          v-if="canUseAdminView"
          class="flex-1 justify-center rounded-full"
          color="neutral"
          variant="soft"
          :icon="isAdminView ? 'i-lucide-user-round' : 'i-lucide-shield-check'"
          :label="isAdminView ? 'Visão membro' : 'Visão administrador'"
          @click="close(); emit('changeView')"
        />
        <UButton
          class="flex-1 justify-center rounded-full"
          color="neutral"
          variant="outline"
          icon="i-lucide-log-out"
          label="Sair"
          @click="close(); emit('signOut')"
        />
      </div>
    </template>
  </UDrawer>
</template>
