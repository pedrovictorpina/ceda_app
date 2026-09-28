<script setup lang="ts">
import { canManageChurch, canOperateStore, canTeachChildren, hasRole } from '~/utils/authorization'
import { bottomNavProfile, buildSearchIndex, findActiveItem, pickBottomNavItems, type SearchableEntry } from '~/utils/navigation'
import type { NavigationItem } from '~/types/domain'
import type { MenuGroup } from './AppMenuSheet.vue'

const route = useRoute()
const auth = useAuthStore()
const { visibleMemberItems, visibleAdministratorItems, visibleSections } = useAppNavigation()
const { recent, ensureLoaded, remember } = useRecentNavigation()
const sidebarCollapsed = ref(false)
const menuOpen = ref(false)

// Páginas de conta ficam no cabeçalho, mas continuam encontráveis pela busca do menu.
const accountEntries: SearchableEntry[] = [
  { label: 'Perfil', icon: 'i-lucide-user-round', to: '/perfil', keywords: ['conta', 'dados'] },
  { label: 'Notificações', icon: 'i-lucide-bell', to: '/notificacoes', keywords: ['avisos', 'alertas'] },
  { label: 'Política de Privacidade', icon: 'i-lucide-file-lock-2', to: '/privacidade', keywords: ['LGPD', 'dados'] }
]

const canUseAdminView = computed(() => canManageChurch(auth.profile))
const isAdminView = computed(() => canUseAdminView.value && (route.path.startsWith('/admin') || route.path.startsWith('/operacao')))
const roleLabel = computed(() => {
  if (hasRole(auth.profile, 'administrator')) return 'Administrador'
  if (hasRole(auth.profile, 'pastor')) return 'Pastor'
  if (hasRole(auth.profile, 'cashier')) return 'Caixa'
  if (hasRole(auth.profile, 'counter')) return 'Balcão/Entrega'
  if (hasRole(auth.profile, 'teacher')) return 'Professor(a)'
  return 'Membro'
})
const activeItems = computed(() => isAdminView.value ? visibleAdministratorItems.value : visibleMemberItems.value)
const activeItem = computed(() => findActiveItem(activeItems.value, route.path))

const bottomItems = computed(() => pickBottomNavItems(activeItems.value, bottomNavProfile({
  isAdminView: isAdminView.value,
  canOperateStore: canOperateStore(auth.profile),
  caresForChildren: Boolean(auth.profile?.hasChildren) || canTeachChildren(auth.profile)
})))

const groupDefinitions = computed<Array<{ id: NonNullable<NavigationItem['group']>, label: string }>>(() => isAdminView.value
  ? [
      { id: 'main', label: 'Painel' },
      { id: 'administration', label: 'Gestão da igreja' },
      { id: 'operations', label: 'Operação' }
    ]
  : [
      { id: 'main', label: 'Principal' },
      { id: 'community', label: 'Comunidade' },
      { id: 'church', label: 'Igreja' },
      { id: 'operations', label: 'Operação' },
      { id: 'more', label: 'Mais' }
    ])

function groupItems(items: NavigationItem[]): MenuGroup[] {
  return groupDefinitions.value
    .map(group => ({ ...group, items: items.filter(item => item.group === group.id) }))
    .filter(group => group.items.length)
}

const sidebarGroups = computed(() => groupItems(activeItems.value))
// No celular, o menu não repete o que já está na barra inferior.
const sheetGroups = computed(() => groupItems(activeItems.value.filter(item => !item.webOnly && !bottomItems.value.includes(item))))
const searchIndex = computed(() => [
  ...buildSearchIndex(activeItems.value.filter(item => !item.webOnly), visibleSections.value),
  ...accountEntries
])
const recentEntries = computed(() => recent.value.flatMap((to) => {
  const entry = searchIndex.value.find(candidate => candidate.to === to)
  return entry ? [entry] : []
}))

function isCurrentRoute(item: NavigationItem) {
  return item === activeItem.value
}

async function openMenu() {
  ensureLoaded()
  menuOpen.value = true
}

async function signOut() {
  menuOpen.value = false
  await auth.signOut()
  await navigateTo('/entrar')
}

async function changeView(view: 'member' | 'administrator') {
  if (view === 'administrator' && !canUseAdminView.value) return
  await navigateTo(view === 'administrator' ? '/admin' : '/inicio')
}

watch(() => route.path, (path) => {
  if (searchIndex.value.some(entry => entry.to === path)) remember(path)
}, { immediate: true })
</script>

<template>
  <div class="min-h-screen bg-default text-default">
    <header class="fixed inset-x-0 top-0 z-40 flex h-16 items-center border-b border-default bg-default/95 px-4 backdrop-blur md:pl-5">
      <div class="flex min-w-0 flex-1 items-center gap-3">
        <UButton
          class="hidden md:inline-flex"
          color="neutral"
          variant="ghost"
          :icon="sidebarCollapsed ? 'i-lucide-panel-left-open' : 'i-lucide-panel-left-close'"
          aria-label="Alternar barra lateral"
          @click="sidebarCollapsed = !sidebarCollapsed"
        />
        <BrandLogo to="/inicio" />
        <UBadge
          class="hidden shrink-0 min-[400px]:inline-flex"
          color="neutral"
          variant="subtle"
        >
          {{ roleLabel }}
        </UBadge>
      </div>
      <div class="flex items-center gap-1 sm:gap-2">
        <div
          v-if="canUseAdminView"
          class="hidden items-center rounded-xl bg-elevated p-1 lg:flex"
          aria-label="Alternar visão"
        >
          <UButton
            size="sm"
            :variant="!isAdminView ? 'soft' : 'ghost'"
            :color="!isAdminView ? 'primary' : 'neutral'"
            label="Visão membro"
            @click="changeView('member')"
          />
          <UButton
            size="sm"
            :variant="isAdminView ? 'soft' : 'ghost'"
            :color="isAdminView ? 'primary' : 'neutral'"
            label="Visão administrador"
            @click="changeView('administrator')"
          />
        </div>
        <UButton
          v-if="canUseAdminView"
          class="lg:hidden"
          color="neutral"
          variant="ghost"
          :icon="isAdminView ? 'i-lucide-user-round' : 'i-lucide-shield-check'"
          :aria-label="isAdminView ? 'Alternar para Visão membro' : 'Alternar para Visão administrador'"
          :title="isAdminView ? 'Visão administrador' : 'Visão membro'"
          @click="changeView(isAdminView ? 'member' : 'administrator')"
        />
        <NavigationAppNotificationsButton />
        <UColorModeButton />
        <UButton
          color="neutral"
          variant="ghost"
          icon="i-lucide-circle-user-round"
          :aria-label="`Perfil de ${auth.profile?.name || 'membro'}`"
          title="Perfil"
          to="/perfil"
        />
      </div>
    </header>

    <aside
      class="fixed bottom-0 left-0 top-16 z-30 hidden flex-col border-r border-default bg-default pb-3 pl-1 pr-3 pt-3 transition-[width] md:flex"
      :class="sidebarCollapsed ? 'w-20' : 'w-68'"
    >
      <!-- Itens dependem do papel carregado no navegador: renderizar só no cliente evita hidratação com links trocados. -->
      <ClientOnly>
        <nav
          aria-label="Navegação principal"
          class="sidebar-scroll-left flex-1 space-y-3 overflow-y-auto"
        >
          <section
            v-for="group in sidebarGroups"
            :key="group.id"
            class="space-y-1"
          >
            <p
              v-if="!sidebarCollapsed"
              class="px-3 py-1.5 text-xs font-semibold text-muted"
            >
              {{ group.label }}
            </p>
            <NuxtLink
              v-for="item in group.items"
              :key="item.to"
              :to="item.to"
              class="focus-ring flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition hover:bg-elevated"
              :class="isCurrentRoute(item) ? 'bg-primary/10 text-primary' : 'text-muted'"
              :title="sidebarCollapsed ? item.label : undefined"
              :aria-current="isCurrentRoute(item) ? 'page' : undefined"
            >
              <UIcon
                :name="item.icon"
                class="size-5 shrink-0"
              />
              <span
                v-if="!sidebarCollapsed"
                class="truncate"
              >{{ item.label }}</span>
            </NuxtLink>
          </section>
        </nav>
        <template #fallback>
          <div class="flex-1" />
        </template>
      </ClientOnly>
      <div class="mt-3 border-t border-default pt-3">
        <UButton
          color="neutral"
          variant="ghost"
          block
          icon="i-lucide-log-out"
          :label="sidebarCollapsed ? undefined : 'Sair'"
          aria-label="Sair da conta"
          :title="sidebarCollapsed ? 'Sair' : undefined"
          @click="signOut"
        />
      </div>
    </aside>

    <main
      class="min-h-screen px-4 pb-24 pt-20 transition-[margin] md:px-8 md:pb-8"
      :class="sidebarCollapsed ? 'md:ml-20' : 'md:ml-68'"
    >
      <div class="mx-auto max-w-6xl">
        <ClientOnly>
          <NavigationAppSectionTabs />
        </ClientOnly>
        <slot />
      </div>
    </main>

    <ClientOnly>
      <NavigationAppBottomNav
        :items="bottomItems"
        :active-to="activeItem?.to"
        :menu-open="menuOpen"
        @open-menu="openMenu"
      />
      <template #fallback>
        <div
          class="safe-bottom fixed inset-x-0 bottom-0 z-40 h-16 border-t border-default bg-default/95 md:hidden"
          aria-hidden="true"
        />
      </template>
    </ClientOnly>

    <NavigationAppMenuSheet
      v-model:open="menuOpen"
      :groups="sheetGroups"
      :search-index="searchIndex"
      :recent="recentEntries"
      :active-to="activeItem?.to"
      :can-use-admin-view="canUseAdminView"
      :is-admin-view="isAdminView"
      @change-view="changeView(isAdminView ? 'member' : 'administrator')"
      @sign-out="signOut"
    />
  </div>
</template>
