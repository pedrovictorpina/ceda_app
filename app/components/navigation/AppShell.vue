<script setup lang="ts">
import { canManageChurch } from '~/utils/authorization'
import type { NavigationItem } from '~/types/domain'

const props = withDefaults(defineProps<{ section?: string }>(), { section: 'Membros' })
const route = useRoute()
const auth = useAuthStore()
const { visibleItems } = useAppNavigation()
const sidebarCollapsed = ref(false)
const menuOpen = ref(false)
const collapsedGroups = ref<Record<string, boolean>>({
  community: true,
  church: true,
  more: true,
  account: true
})

const mobilePrimary = computed(() => visibleItems.value.filter(item => ['/inicio', '/eventos', '/notificacoes'].includes(item.to)))
const menuItems = computed(() => visibleItems.value.filter(item => !item.webOnly || !menuOpen.value))
const menuGroups = computed(() => {
  const definitions: Array<{ id: NonNullable<NavigationItem['group']>, label: string, icon: string, collapsible: boolean }> = [
    { id: 'main', label: 'Principal', icon: 'i-lucide-house', collapsible: false },
    { id: 'community', label: 'Comunidade', icon: 'i-lucide-users', collapsible: true },
    { id: 'church', label: 'Igreja', icon: 'i-lucide-landmark', collapsible: true },
    { id: 'more', label: 'Mais', icon: 'i-lucide-ellipsis', collapsible: true },
    { id: 'account', label: 'Conta', icon: 'i-lucide-circle-user-round', collapsible: true },
    { id: 'administration', label: 'Administração', icon: 'i-lucide-shield-check', collapsible: false }
  ]
  return definitions.map(group => ({
    ...group,
    items: menuItems.value.filter(item => item.group === group.id)
  })).filter(group => group.items.length)
})
const canUseAdminView = computed(() => canManageChurch(auth.profile))
const isAdminView = computed(() => route.path.startsWith('/admin'))

function isGroupOpen(id: string, collapsible: boolean, items: NavigationItem[]) {
  return !collapsible || !collapsedGroups.value[id] || items.some(item => route.path.startsWith(item.to))
}

function toggleGroup(id: string) {
  collapsedGroups.value[id] = !collapsedGroups.value[id]
}

function closeOnEscape(event: KeyboardEvent) {
  if (event.key === 'Escape') menuOpen.value = false
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
</script>

<template>
  <div
    class="min-h-screen bg-default text-default"
    @keydown="closeOnEscape"
  >
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
          class="hidden sm:inline-flex"
          color="neutral"
          variant="subtle"
        >
          {{ props.section }}
        </UBadge>
      </div>
      <div class="flex items-center gap-2">
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
        <UColorModeButton />
        <UButton
          color="neutral"
          variant="ghost"
          icon="i-lucide-circle-user-round"
          :aria-label="auth.profile?.name || 'Perfil'"
          to="/perfil"
        />
      </div>
    </header>

    <aside
      class="fixed bottom-0 left-0 top-16 z-30 hidden flex-col border-r border-default bg-default pb-3 pl-1 pr-3 pt-3 transition-[width] md:flex"
      :class="sidebarCollapsed ? 'w-20' : 'w-68'"
    >
      <nav
        aria-label="Navegação principal"
        class="sidebar-scroll-left flex-1 space-y-3 overflow-y-auto"
      >
        <section
          v-for="group in menuGroups"
          :key="group.id"
          class="space-y-1"
        >
          <button
            v-if="!sidebarCollapsed && group.collapsible"
            type="button"
            class="focus-ring flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted hover:bg-elevated"
            :aria-expanded="isGroupOpen(group.id, group.collapsible, group.items)"
            @click="toggleGroup(group.id)"
          >
            <span>{{ group.label }}</span>
            <UIcon
              :name="isGroupOpen(group.id, group.collapsible, group.items) ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
              class="size-4"
            />
          </button>
          <p
            v-else-if="!sidebarCollapsed && !group.collapsible"
            class="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted"
          >
            {{ group.label }}
          </p>
          <div
            v-show="sidebarCollapsed || isGroupOpen(group.id, group.collapsible, group.items)"
            class="space-y-1"
          >
            <NuxtLink
              v-for="item in group.items"
              :key="item.to"
              :to="item.to"
              class="focus-ring flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition hover:bg-elevated"
              :class="route.path.startsWith(item.to) ? 'bg-primary/10 text-primary' : 'text-muted'"
              :title="sidebarCollapsed ? item.label : undefined"
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
          </div>
        </section>
      </nav>
      <div class="mt-3 border-t border-default pt-3">
        <UButton
          color="neutral"
          variant="ghost"
          block
          icon="i-lucide-log-out"
          :label="sidebarCollapsed ? undefined : 'Sair'
          "
          :aria-label="'Sair da conta'"
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
        <slot />
      </div>
    </main>

    <nav
      aria-label="Navegação móvel"
      class="safe-bottom fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-default bg-default/95 px-2 pt-2 backdrop-blur md:hidden"
    >
      <NuxtLink
        v-for="item in mobilePrimary"
        :key="item.to"
        :to="item.to"
        class="focus-ring flex min-h-12 flex-col items-center justify-center rounded-lg text-xs"
        :class="route.path.startsWith(item.to) ? 'text-primary' : 'text-muted'"
      >
        <UIcon
          :name="item.icon"
          class="size-5"
        /><span>{{ item.label }}</span>
      </NuxtLink>
      <button
        class="focus-ring flex min-h-12 flex-col items-center justify-center rounded-lg text-xs text-muted"
        aria-controls="mobile-menu"
        :aria-expanded="menuOpen"
        @click="menuOpen = true"
      >
        <UIcon
          name="i-lucide-menu"
          class="size-5"
        /><span>Menu</span>
      </button>
    </nav>

    <div
      v-if="menuOpen"
      class="fixed inset-0 z-50 md:hidden"
    >
      <button
        class="absolute inset-0 bg-black/60"
        aria-label="Fechar menu"
        @click="menuOpen = false"
      />
      <aside
        id="mobile-menu"
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        class="absolute inset-y-0 left-0 w-[min(86vw,20rem)] overflow-y-auto bg-default p-4 shadow-2xl"
      >
        <div class="mb-5 flex items-center justify-between">
          <p class="font-semibold">
            Menu
          </p>
          <UButton
            color="neutral"
            variant="ghost"
            icon="i-lucide-x"
            aria-label="Fechar menu"
            @click="menuOpen = false"
          />
        </div>
        <nav class="space-y-3">
          <section
            v-for="group in menuGroups"
            :key="group.id"
            class="space-y-1"
          >
            <button
              v-if="group.collapsible"
              type="button"
              class="focus-ring flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted hover:bg-elevated"
              :aria-expanded="isGroupOpen(group.id, group.collapsible, group.items)"
              @click="toggleGroup(group.id)"
            >
              <span>{{ group.label }}</span>
              <UIcon
                :name="isGroupOpen(group.id, group.collapsible, group.items) ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
                class="size-4"
              />
            </button>
            <p
              v-else
              class="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted"
            >
              {{ group.label }}
            </p>
            <div
              v-show="isGroupOpen(group.id, group.collapsible, group.items)"
              class="space-y-1"
            >
              <NuxtLink
                v-for="item in group.items"
                :key="item.to"
                :to="item.to"
                class="focus-ring flex items-center gap-3 rounded-lg px-3 py-3 text-sm"
                @click="menuOpen = false"
              >
                <UIcon
                  :name="item.icon"
                  class="size-5"
                />{{ item.label }}
              </NuxtLink>
            </div>
          </section>
        </nav>
        <div class="mt-4 border-t border-default pt-4">
          <UButton
            color="neutral"
            variant="outline"
            block
            icon="i-lucide-log-out"
            label="Sair"
            @click="signOut"
          />
        </div>
      </aside>
    </div>
  </div>
</template>
