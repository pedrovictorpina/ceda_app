<script setup lang="ts">
definePageMeta({ middleware: 'auth' })
useSeoMeta({ title: 'Comunidade' })
const query = ref('')
const groups = [{ name: 'Famílias', visibility: 'Membros', detail: 'Encontros quinzenais' }, { name: 'Jovens', visibility: 'Privado', detail: 'Informações completas após aprovação' }]
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
    /><div class="grid gap-4 sm:grid-cols-2">
      <UCard
        v-for="group in groups"
        :key="group.name"
      >
        <div class="flex items-start justify-between gap-3">
          <div>
            <h2 class="font-semibold">
              {{ group.name }}
            </h2><p class="mt-1 text-sm text-muted">
              {{ group.detail }}
            </p>
          </div><UBadge
            color="neutral"
            variant="subtle"
          >
            {{ group.visibility }}
          </UBadge>
        </div><template #footer>
          <UButton
            size="sm"
            variant="soft"
            label="Solicitar entrada"
          />
        </template>
      </UCard>
    </div>
  </div>
</template>
