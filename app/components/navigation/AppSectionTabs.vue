<script setup lang="ts">
import { findActiveTab, findSectionForPath } from '~/utils/navigation'

const route = useRoute()
const { visibleSections } = useAppNavigation()

const section = computed(() => findSectionForPath(visibleSections.value, route.path))
const activeTab = computed(() => section.value ? findActiveTab(section.value.tabs, route.path) : undefined)
</script>

<template>
  <nav
    v-if="section"
    :aria-label="section.label"
    class="-mx-4 mb-5 overflow-x-auto px-4 md:mx-0 md:px-0"
  >
    <ul class="flex w-max gap-2">
      <li
        v-for="tab in section.tabs"
        :key="tab.to"
      >
        <NuxtLink
          :to="tab.to"
          class="focus-ring flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-medium transition"
          :class="tab === activeTab
            ? 'border-primary bg-primary text-white shadow-sm shadow-primary/20'
            : 'border-default bg-default text-muted hover:bg-elevated hover:text-default'"
          :aria-current="tab === activeTab ? 'page' : undefined"
        >
          <UIcon
            :name="tab.icon"
            class="size-4"
          />
          {{ tab.label }}
        </NuxtLink>
      </li>
    </ul>
  </nav>
</template>
