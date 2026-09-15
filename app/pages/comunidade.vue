<script setup lang="ts">
import { communityGroups } from '~/data/contentCatalog'

definePageMeta({ middleware: 'auth' })
useSeoMeta({ title: 'Comunidade' })
const query = ref('')
const requestedGroups = ref<string[]>([])
const filteredGroups = computed(() => {
  const term = query.value.trim().toLocaleLowerCase('pt-BR')
  if (!term) return communityGroups
  return communityGroups.filter(group => `${group.name} ${group.detail}`.toLocaleLowerCase('pt-BR').includes(term))
})

function toggleRequest(name: string) {
  requestedGroups.value = requestedGroups.value.includes(name)
    ? requestedGroups.value.filter(item => item !== name)
    : [...requestedGroups.value, name]
}
</script>

<template>
  <div>
    <PageIntro
      title="Comunidade"
      description="Encontre grupos, solicite participação e acompanhe as comunidades das quais você faz parte."
      icon="i-lucide-users"
    /><UInput
      v-model="query"
      icon="i-lucide-search"
      placeholder="Buscar comunidades"
      class="mb-5 w-full max-w-lg"
    /><div
      v-if="filteredGroups.length"
      class="grid gap-4 sm:grid-cols-2"
    >
      <UCard
        v-for="group in filteredGroups"
        :key="group.name"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="flex items-start gap-3">
            <div class="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <UIcon
                :name="group.icon"
                class="size-5"
              />
            </div>
            <div>
              <h2 class="font-semibold">
                {{ group.name }}
              </h2><p class="mt-1 text-sm text-muted">
                {{ group.detail }}
              </p>
              <p class="mt-3 text-xs font-medium text-primary">
                {{ group.members }}
              </p>
            </div>
          </div><UBadge
            color="neutral"
            variant="subtle"
          >
            {{ group.visibility }}
          </UBadge>
        </div><template #footer>
          <UButton
            size="sm"
            :color="requestedGroups.includes(group.name) ? 'neutral' : 'primary'"
            :variant="requestedGroups.includes(group.name) ? 'outline' : 'soft'"
            :icon="requestedGroups.includes(group.name) ? 'i-lucide-check' : 'i-lucide-user-plus'"
            :label="requestedGroups.includes(group.name) ? 'Interesse registrado' : 'Tenho interesse'"
            @click="toggleRequest(group.name)"
          />
        </template>
      </UCard>
    </div>
    <div
      v-else
      class="rounded-xl border border-dashed border-default py-12 text-center"
    >
      <UIcon
        name="i-lucide-search-x"
        class="mx-auto size-9 text-muted"
      />
      <h2 class="mt-3 font-semibold">
        Nenhum grupo encontrado
      </h2>
      <p class="mt-1 text-sm text-muted">
        Tente buscar por outro nome ou tema.
      </p>
      <UButton
        class="mt-4"
        color="neutral"
        variant="outline"
        label="Limpar busca"
        @click="query = ''"
      />
    </div>
  </div>
</template>
