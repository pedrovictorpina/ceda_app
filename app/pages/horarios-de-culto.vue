<script setup lang="ts">
definePageMeta({ layout: 'public' })
useSeoMeta({ title: 'Horários de Culto' })
const services = [{ title: 'Culto de celebração', schedule: 'Domingos, 19h', place: 'Templo', next: true }, { title: 'Culto de oração', schedule: 'Quartas, 20h', place: 'Templo', next: false }]
</script>

<template>
  <div>
    <PageIntro
      title="Horários de Culto"
      description="Recorrências e próximos cultos derivados do calendário central."
      icon="i-lucide-clock-3"
    /><div class="grid gap-4 sm:grid-cols-2">
      <UCard
        v-for="service in services"
        :key="service.title"
        :class="service.next ? 'ring-2 ring-primary/40' : ''"
      >
        <div class="flex items-center justify-between">
          <h2 class="font-semibold">
            {{ service.title }}
          </h2><UBadge
            v-if="service.next"
            label="Próximo"
          />
        </div><p class="mt-2 text-muted">
          {{ service.schedule }}
        </p><p class="mt-1 text-sm text-muted">
          {{ service.place }}
        </p>
      </UCard>
    </div>
  </div>
</template>
