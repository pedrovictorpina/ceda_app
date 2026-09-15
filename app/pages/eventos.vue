<script setup lang="ts">
import { upcomingEvents } from '~/data/contentCatalog'

definePageMeta({ middleware: 'auth' })
useSeoMeta({ title: 'Eventos' })

const view = ref<'list' | 'month'>('list')
const filter = ref('all')
const reminders = ref<string[]>([])
const calendarDate = new Date()
const calendarYear = calendarDate.getFullYear()
const calendarMonth = calendarDate.getMonth()
const calendarTitle = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' })
  .format(calendarDate)
  .replace(/^./, letter => letter.toLocaleUpperCase('pt-BR'))

const monthDays = computed(() => {
  const leadingDays = new Date(calendarYear, calendarMonth, 1).getDay()
  const currentMonthTotal = new Date(calendarYear, calendarMonth + 1, 0).getDate()
  const previousMonthTotal = new Date(calendarYear, calendarMonth, 0).getDate()
  return Array.from({ length: 42 }, (_, index) => {
    const relativeDay = index - leadingDays + 1
    if (relativeDay < 1) return { day: previousMonthTotal + relativeDay, current: false }
    if (relativeDay > currentMonthTotal) return { day: relativeDay - currentMonthTotal, current: false }
    return { day: relativeDay, current: true }
  })
})

const eventDays = computed<Record<number, string[]>>(() => {
  const result: Record<number, string[]> = {}
  const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate()
  let saturdayCount = 0
  let thursdayAdded = false
  for (let day = 1; day <= daysInMonth; day += 1) {
    const weekday = new Date(calendarYear, calendarMonth, day).getDay()
    if (weekday === 0) result[day] = ['Culto de celebração']
    if (weekday === 4 && !thursdayAdded) {
      result[day] = ['Encontro de famílias']
      thursdayAdded = true
    }
    if (weekday === 6) {
      saturdayCount += 1
      if (saturdayCount === 1) result[day] = ['Ensaio de música']
      if (saturdayCount === 2) result[day] = ['Ação solidária']
    }
  }
  return result
})

const filterItems = [
  { label: 'Todos', value: 'all' },
  { label: 'Cultos', value: 'Culto' },
  { label: 'Encontros', value: 'Encontro' },
  { label: 'Ensaios', value: 'Ensaio' },
  { label: 'Ação social', value: 'Ação social' }
]

const filteredEvents = computed(() => filter.value === 'all'
  ? upcomingEvents
  : upcomingEvents.filter(event => event.kind === filter.value))

function toggleReminder(id: string) {
  reminders.value = reminders.value.includes(id)
    ? reminders.value.filter(item => item !== id)
    : [...reminders.value, id]
}
</script>

<template>
  <div>
    <PageIntro
      title="Calendário e eventos"
      description="Consulte cultos, eventos, reuniões, ensaios e atividades."
      icon="i-lucide-calendar-days"
    />

    <div class="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
      <div class="inline-flex w-fit rounded-lg bg-elevated p-1">
        <UButton
          :variant="view === 'list' ? 'solid' : 'ghost'"
          size="sm"
          icon="i-lucide-list"
          label="Lista"
          @click="view = 'list'"
        />
        <UButton
          :variant="view === 'month' ? 'solid' : 'ghost'"
          size="sm"
          icon="i-lucide-calendar-range"
          label="Mês"
          @click="view = 'month'"
        />
      </div>
      <USelect
        v-model="filter"
        :items="filterItems"
        class="w-full sm:w-48"
        aria-label="Filtrar eventos"
      />
    </div>

    <section
      v-if="view === 'month'"
      aria-label="Calendário mensal"
    >
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-muted">
                Calendário da comunidade
              </p><h2 class="text-xl font-bold">
                {{ calendarTitle }}
              </h2>
            </div>
            <UBadge
              variant="subtle"
              label="4 atividades"
            />
          </div>
        </template>
        <div class="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-default bg-default">
          <div
            v-for="weekday in ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']"
            :key="weekday"
            class="bg-elevated px-1 py-2 text-center text-xs font-semibold text-muted sm:px-3"
          >
            {{ weekday }}
          </div>
          <div
            v-for="(cell, index) in monthDays"
            :key="index"
            class="min-h-18 bg-default p-1.5 sm:min-h-24 sm:p-2"
            :class="!cell.current ? 'opacity-35' : ''"
          >
            <span class="text-xs font-medium sm:text-sm">{{ cell.day }}</span>
            <div
              v-if="cell.current && eventDays[cell.day]"
              class="mt-1 space-y-1"
            >
              <div
                v-for="eventName in eventDays[cell.day]"
                :key="eventName"
                class="truncate rounded bg-primary/10 px-1.5 py-1 text-[10px] font-medium text-primary sm:text-xs"
                :title="eventName"
              >
                {{ eventName }}
              </div>
            </div>
          </div>
        </div>
      </UCard>
    </section>

    <section
      v-else
      class="space-y-3"
      aria-live="polite"
    >
      <UCard
        v-for="event in filteredEvents"
        :key="event.id"
      >
        <div class="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
          <div class="flex items-start gap-4">
            <div class="grid size-14 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
              <UIcon
                name="i-lucide-calendar"
                class="size-7"
              />
            </div>
            <div>
              <div class="flex flex-wrap items-center gap-2">
                <h2 class="text-lg font-semibold">
                  {{ event.title }}
                </h2>
                <UBadge
                  color="neutral"
                  variant="subtle"
                >
                  {{ event.kind }}
                </UBadge>
              </div>
              <p class="mt-1 font-medium text-primary">
                {{ event.date }} · {{ event.time }}
              </p>
              <p class="mt-1 flex items-center gap-1.5 text-sm text-muted">
                <UIcon name="i-lucide-map-pin" />{{ event.location }}
              </p>
              <p class="mt-3 max-w-2xl text-sm leading-6 text-muted">
                {{ event.description }}
              </p>
            </div>
          </div>
          <UButton
            class="shrink-0"
            :color="reminders.includes(event.id) ? 'primary' : 'neutral'"
            :variant="reminders.includes(event.id) ? 'soft' : 'outline'"
            :icon="reminders.includes(event.id) ? 'i-lucide-bell-ring' : 'i-lucide-bell-plus'"
            :label="reminders.includes(event.id) ? 'Lembrete ativo' : 'Quero ser lembrado'"
            @click="toggleReminder(event.id)"
          />
        </div>
      </UCard>
      <div
        v-if="!filteredEvents.length"
        class="rounded-xl border border-dashed border-default py-12 text-center"
      >
        <UIcon
          name="i-lucide-calendar-x-2"
          class="mx-auto size-9 text-muted"
        />
        <h2 class="mt-3 font-semibold">
          Nenhum evento neste filtro
        </h2>
        <UButton
          class="mt-4"
          color="neutral"
          variant="outline"
          label="Mostrar todos"
          @click="filter = 'all'"
        />
      </div>
    </section>
  </div>
</template>
