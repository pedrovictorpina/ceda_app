<script setup lang="ts">
import type { NavigationItem } from '~/types/domain'

defineProps<{ items: NavigationItem[], activeTo?: string, menuOpen: boolean }>()
const emit = defineEmits<{ openMenu: [] }>()
</script>

<template>
  <nav
    aria-label="Navegação móvel"
    class="hide-while-typing safe-bottom fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-default bg-default/95 px-1 pt-1.5 backdrop-blur md:hidden"
  >
    <NuxtLink
      v-for="item in items"
      :key="item.to"
      :to="item.to"
      class="focus-ring flex min-h-12 min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl text-[0.7rem] font-medium leading-tight tracking-tight"
      :class="item.to === activeTo ? 'text-primary' : 'text-muted'"
      :aria-current="item.to === activeTo ? 'page' : undefined"
    >
      <span
        class="grid h-7 w-12 place-items-center rounded-full transition-colors"
        :class="item.to === activeTo ? 'bg-primary/15' : ''"
      >
        <UIcon
          :name="item.icon"
          class="size-5"
        />
      </span>
      <span class="max-w-full truncate">{{ item.shortLabel || item.label }}</span>
    </NuxtLink>
    <button
      type="button"
      class="focus-ring flex min-h-12 min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl text-[0.7rem] font-medium leading-tight tracking-tight"
      :class="menuOpen ? 'text-primary' : 'text-muted'"
      aria-haspopup="dialog"
      :aria-expanded="menuOpen"
      @click="emit('openMenu')"
    >
      <span
        class="grid h-7 w-12 place-items-center rounded-full transition-colors"
        :class="menuOpen ? 'bg-primary/15' : ''"
      >
        <UIcon
          name="i-lucide-layout-grid"
          class="size-5"
        />
      </span>
      <span>Menu</span>
    </button>
  </nav>
</template>
