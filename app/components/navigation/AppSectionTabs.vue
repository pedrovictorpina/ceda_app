<script setup lang="ts">
import { findActiveTab, findSectionForPath } from '~/utils/navigation'

const route = useRoute()
const { visibleSections } = useAppNavigation()

const section = computed(() => findSectionForPath(visibleSections.value, route.path))
const activeTab = computed(() => section.value ? findActiveTab(section.value.tabs, route.path) : undefined)
const items = computed(() => section.value?.tabs.map(tab => ({ ...tab, active: tab === activeTab.value })))
</script>

<template>
  <div
    v-if="section"
    class="-mx-4 mb-5 overflow-x-auto px-4 md:mx-0 md:px-0"
  >
    <UNavigationMenu
      :items="items"
      :aria-label="section.label"
      variant="pill"
      :ui="{ list: 'w-max gap-2', link: 'min-h-11 rounded-full border border-default px-4', linkLeadingIcon: 'size-4' }"
    />
  </div>
</template>
