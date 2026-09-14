<script setup lang="ts">
definePageMeta({ middleware: 'auth' })
useSeoMeta({ title: 'Eventos' })
const view = ref<'list' | 'month'>('list')
const filter = ref('all')
const events = [{ title: 'Culto de celebração', kind: 'Culto', when: 'Domingo, 19h', where: 'Templo' }, { title: 'Ensaio de música', kind: 'Ensaio', when: 'Sábado, 16h', where: 'Auditório' }, { title: 'Encontro de famílias', kind: 'Grupo', when: '18 de setembro, 20h', where: 'Sala 2' }]
</script>

<template>
  <div>
    <PageIntro
      title="Calendário e eventos"
      description="Consulte cultos, eventos, reuniões, ensaios e atividades."
      icon="i-lucide-calendar-days"
    /><div class="mb-5 flex flex-wrap gap-3">
      <UButton
        :variant="view === 'list' ? 'solid' : 'outline'"
        label="Lista"
        @click="view = 'list'"
      /><UButton
        :variant="view === 'month' ? 'solid' : 'outline'"
        label="Mês"
        @click="view = 'month'"
      /><USelect
        v-model="filter"
        :items="[{ label: 'Todos', value: 'all' }, { label: 'Cultos', value: 'service' }, { label: 'Ensaios', value: 'rehearsal' }]"
        class="w-40"
        aria-label="Filtrar eventos"
      />
    </div><UAlert
      v-if="view === 'month'"
      class="mb-5"
      color="neutral"
      variant="subtle"
      title="Visão mensal preparada"
      description="O calendário visual completo entra na próxima fase; os eventos reais já têm modelo persistente."
    /><div class="space-y-3">
      <UCard
        v-for="event in events"
        :key="event.title"
      >
        <div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div class="flex items-center gap-2">
              <h2 class="font-semibold">
                {{ event.title }}
              </h2><UBadge
                color="neutral"
                variant="subtle"
              >
                {{ event.kind }}
              </UBadge>
            </div><p class="mt-1 text-sm text-muted">
              {{ event.when }} · {{ event.where }}
            </p>
          </div><UButton
            color="neutral"
            variant="outline"
            icon="i-lucide-bell-plus"
            label="Quero ser lembrado"
          />
        </div>
      </UCard>
    </div>
  </div>
</template>
