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
const searchInput = useTemplateRef('searchInput')
const results = computed(() => searchNavigation(props.searchIndex, search.value))

function clearSearch() {
  search.value = ''
  searchInput.value?.inputRef?.focus()
}

function close() {
  open.value = false
}

watch(open, (isOpen) => {
  if (!isOpen) search.value = ''
})
</script>

<template>
  <UModal
    v-model:open="open"
    fullscreen
    title="Menu"
    :description="isAdminView ? 'Ferramentas de administração da CEDA' : 'Acesse todas as áreas da CEDA'"
    :ui="{
      overlay: 'z-50 bg-default',
      content: 'z-50 h-dvh w-full max-w-none min-h-0 overflow-hidden rounded-none shadow-none ring-0',
      header: 'shrink-0 px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))] sm:px-4 min-h-0',
      wrapper: 'min-w-0 flex-1 pe-14',
      title: 'text-xl font-bold',
      description: 'text-sm',
      body: 'flex min-h-0 flex-1 flex-col overflow-hidden p-0 sm:p-0',
      footer: 'safe-bottom flex-col shrink-0 gap-2 bg-default p-4 sm:px-4'
    }"
  >
    <template #close>
      <UButton
        class="absolute end-4 top-[max(1rem,env(safe-area-inset-top))]"
        size="lg"
        color="neutral"
        variant="ghost"
        icon="i-lucide-x"
        aria-label="Fechar menu"
      />
    </template>
    <template #body>
      <div class="shrink-0 border-b border-default px-4 py-3">
        <UInput
          ref="searchInput"
          v-model="search"
          class="w-full"
          size="xl"
          icon="i-lucide-search"
          placeholder="Qual página você procura?"
          aria-label="Buscar no menu"
          autocomplete="off"
          enterkeyhint="search"
          :ui="{ base: 'rounded-xl', trailing: 'pe-1' }"
        >
          <template
            v-if="search"
            #trailing
          >
            <UButton
              color="neutral"
              variant="ghost"
              icon="i-lucide-x"
              aria-label="Limpar busca"
              @click="clearSearch"
            />
          </template>
        </UInput>
      </div>

      <nav
        class="mobile-menu-scroll min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-4 py-4"
        aria-label="Páginas do aplicativo"
      >
        <div v-if="search.trim()">
          <p
            class="mb-3 text-sm font-semibold text-muted"
            role="status"
            aria-live="polite"
          >
            {{ results.length }} {{ results.length === 1 ? 'página encontrada' : 'páginas encontradas' }}
          </p>
          <ul
            v-if="results.length"
            class="grid grid-cols-3 gap-2"
          >
            <li
              v-for="entry in results"
              :key="entry.to"
              class="min-w-0"
            >
              <NavigationAppMenuTile
                :item="entry"
                :active="entry.to === activeTo"
                @navigate="close"
              />
            </li>
          </ul>
          <div
            v-else
            class="px-3 py-10 text-center"
          >
            <UIcon
              name="i-lucide-search"
              class="size-8 text-dimmed"
            />
            <p class="mt-3 font-semibold">
              Nenhuma página encontrada
            </p>
            <p class="mt-1 wrap-anywhere text-sm text-muted">
              Tente buscar por “culto”, “oração” ou “perfil”.
            </p>
          </div>
        </div>

        <div
          v-else
          class="space-y-6"
        >
          <section
            v-if="recent.length > 1"
            aria-labelledby="menu-recentes"
          >
            <h3
              id="menu-recentes"
              class="mb-3 text-xs font-semibold uppercase tracking-wider text-muted"
            >
              Recentes
            </h3>
            <ul class="grid grid-cols-3 gap-2">
              <li
                v-for="entry in recent.slice(0, 3)"
                :key="entry.to"
                class="min-w-0"
              >
                <NavigationAppMenuTile
                  :item="entry"
                  compact
                  @navigate="close"
                />
              </li>
            </ul>
          </section>

          <section
            v-for="group in groups"
            :key="group.id"
            :aria-labelledby="`menu-${group.id}`"
          >
            <h3
              :id="`menu-${group.id}`"
              class="mb-3 text-xs font-semibold uppercase tracking-wider text-muted"
            >
              {{ group.label }}
            </h3>
            <ul class="grid grid-cols-3 gap-2">
              <li
                v-for="item in group.items"
                :key="item.to"
                class="min-w-0"
              >
                <NavigationAppMenuTile
                  :item="item"
                  :active="item.to === activeTo"
                  @navigate="close"
                />
              </li>
            </ul>
          </section>
        </div>
      </nav>
    </template>

    <template #footer>
      <UButton
        v-if="canUseAdminView"
        block
        class="min-w-0 justify-start"
        color="neutral"
        variant="soft"
        :icon="isAdminView ? 'i-lucide-user-round' : 'i-lucide-shield-check'"
        :label="isAdminView ? 'Voltar para o app' : 'Área administrativa'"
        trailing-icon="i-lucide-chevron-right"
        :ui="{ label: 'flex-1 whitespace-normal text-left' }"
        @click="close(); emit('changeView')"
      />
      <UButton
        block
        class="min-w-0 justify-start"
        color="neutral"
        variant="ghost"
        icon="i-lucide-log-out"
        label="Sair da conta"
        @click="close(); emit('signOut')"
      />
    </template>
  </UModal>
</template>

<style scoped>
.mobile-menu-scroll {
  scrollbar-width: thin;
  scrollbar-color: var(--ui-border-accented) transparent;
}

.mobile-menu-scroll::-webkit-scrollbar {
  width: 4px;
  height: 0;
}

.mobile-menu-scroll::-webkit-scrollbar-track {
  background: transparent;
}

.mobile-menu-scroll::-webkit-scrollbar-thumb {
  background: var(--ui-border-accented);
  border: 0;
}
</style>
