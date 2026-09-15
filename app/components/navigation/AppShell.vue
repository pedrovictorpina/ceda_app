<script setup lang="ts">
const props = withDefaults(defineProps<{ section?: string }>(), { section: 'Membros' })
const route = useRoute()
const auth = useAuthStore()
const { visibleItems } = useAppNavigation()
const sidebarCollapsed = ref(false)
const menuOpen = ref(false)

const mobilePrimary = computed(() => visibleItems.value.filter(item => ['/inicio', '/eventos', '/notificacoes'].includes(item.to)))
const sidebarItems = computed(() => visibleItems.value.filter(item => !item.webOnly || !menuOpen.value))

function closeOnEscape(event: KeyboardEvent) {
  if (event.key === 'Escape') menuOpen.value = false
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
      class="fixed bottom-0 left-0 top-16 z-30 hidden border-r border-default bg-default p-3 transition-[width] md:block"
      :class="sidebarCollapsed ? 'w-20' : 'w-68'"
    >
      <nav
        aria-label="Navegação principal"
        class="space-y-1"
      >
        <NuxtLink
          v-for="item in visibleItems"
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
      </nav>
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
        <nav class="space-y-1">
          <NuxtLink
            v-for="item in sidebarItems"
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
        </nav>
      </aside>
    </div>
  </div>
</template>
