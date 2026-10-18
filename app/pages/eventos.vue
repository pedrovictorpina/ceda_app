<script setup lang="ts">
import type { ReminderLead } from '~/types/domain'
import { agendaDateKey, calendarMonthCells, downloadEventCalendar, eventKindLabels, eventsForMonth, formatAgendaDate } from '~/utils/churchAgenda'

definePageMeta({ middleware: 'auth' })
useSeoMeta({ title: 'Eventos' })
const { events, loading, errorMessage, load } = useChurchAgenda()
const reminders = useEventReminders()
const view = ref<'list' | 'month'>('list')
const filter = ref('all')
const today = agendaDateKey(new Date())
const month = ref(Number(today.slice(5, 7)) - 1)
const year = ref(Number(today.slice(0, 4)))
const selectedDate = ref('')
const lead = ref<ReminderLead>('day')
const calendarTitle = computed(() => new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year.value, month.value, 1))))
const monthDays = computed(() => calendarMonthCells(year.value, month.value))
const filteredEvents = computed(() => eventsForMonth(events.value, year.value, month.value, filter.value))
const visibleEvents = computed(() => view.value === 'month' && selectedDate.value ? filteredEvents.value.filter(event => agendaDateKey(event.starts_at) === selectedDate.value) : filteredEvents.value)
const countOn = (key: string) => filteredEvents.value.filter(event => agendaDateKey(event.starts_at) === key).length
const filterItems = [{ label: 'Todos os tipos', value: 'all' }, ...Object.entries(eventKindLabels).map(([value, label]) => ({ value, label }))]
const leadItems = [{ label: '1 hora antes', value: 'hour' }, { label: '1 dia antes', value: 'day' }, { label: '1 semana antes', value: 'week' }]

function loadMonth() {
  const from = new Date(`${year.value}-${String(month.value + 1).padStart(2, '0')}-01T00:00:00-03:00`)
  const next = new Date(Date.UTC(year.value, month.value + 1, 1, 12)).toISOString().slice(0, 10)
  return load(from, new Date(`${next}T00:00:00-03:00`))
}
function moveMonth(offset: number) {
  const date = new Date(Date.UTC(year.value, month.value + offset, 1))
  month.value = date.getUTCMonth()
  year.value = date.getUTCFullYear()
  selectedDate.value = ''
  void loadMonth()
}
function currentMonth() {
  month.value = Number(today.slice(5, 7)) - 1
  year.value = Number(today.slice(0, 4))
  selectedDate.value = ''
  void loadMonth()
}
onMounted(() => {
  void loadMonth()
  void reminders.load()
})
</script>

<template>
  <div>
    <PageIntro
      title="Calendário e eventos"
      description="Encontros publicados pela CEDA. Horários de Brasília."
      icon="i-lucide-calendar-days"
    />
    <div class="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div class="flex items-center gap-1">
        <UButton
          color="neutral"
          variant="outline"
          icon="i-lucide-chevron-left"
          aria-label="Mês anterior"
          @click="moveMonth(-1)"
        />
        <h2 class="min-w-36 px-2 text-center font-semibold capitalize">
          {{ calendarTitle }}
        </h2>
        <UButton
          color="neutral"
          variant="outline"
          icon="i-lucide-chevron-right"
          aria-label="Próximo mês"
          @click="moveMonth(1)"
        />
        <UButton
          color="neutral"
          variant="ghost"
          label="Hoje"
          @click="currentMonth"
        />
      </div>
      <div class="flex w-full flex-wrap gap-3 sm:w-auto">
        <div
          class="inline-flex rounded-lg bg-elevated p-1"
          role="group"
          aria-label="Modo de visualização"
        >
          <UButton
            :variant="view === 'list' ? 'solid' : 'ghost'"
            :aria-pressed="view === 'list'"
            icon="i-lucide-list"
            label="Lista"
            @click="view = 'list'"
          />
          <UButton
            :variant="view === 'month' ? 'solid' : 'ghost'"
            :aria-pressed="view === 'month'"
            icon="i-lucide-calendar-range"
            label="Mês"
            @click="view = 'month'"
          />
        </div>
        <USelect
          v-model="filter"
          :items="filterItems"
          class="min-w-44 flex-1"
          aria-label="Filtrar tipos de encontro"
        />
      </div>
    </div>
    <div
      v-if="loading"
      role="status"
      class="py-12 text-center text-muted"
    >
      Carregando a agenda…
    </div>
    <UAlert
      v-else-if="errorMessage"
      title="Agenda indisponível"
      :description="errorMessage"
      color="error"
      variant="soft"
      :actions="[{ label: 'Tentar novamente', onClick: loadMonth }]"
    />
    <template v-else>
      <p
        class="mb-4 text-sm text-muted"
        aria-live="polite"
      >
        {{ filteredEvents.length }} encontro(s) neste mês e filtro.
      </p>
      <UCard
        v-if="view === 'month'"
        class="mb-5"
      >
        <div
          class="grid grid-cols-7 gap-1"
          aria-label="Escolha um dia para ver seus encontros"
        >
          <div
            v-for="weekday in ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']"
            :key="weekday"
            class="py-2 text-center text-xs font-semibold text-muted"
          >
            {{ weekday }}
          </div>
          <UButton
            v-for="cell in monthDays"
            :key="cell.key"
            :disabled="!cell.current"
            :variant="selectedDate === cell.key ? 'solid' : 'ghost'"
            :color="selectedDate === cell.key ? 'primary' : 'neutral'"
            :aria-pressed="selectedDate === cell.key"
            :aria-label="`${cell.day} de ${calendarTitle}: ${countOn(cell.key)} encontro(s)`"
            :class="cell.key === today ? 'ring-1 ring-primary' : ''"
            class="relative min-h-14 min-w-0 justify-center px-0 pb-4"
            @click="selectedDate = selectedDate === cell.key ? '' : cell.key"
          >
            {{ cell.day }}
            <span
              v-if="countOn(cell.key)"
              class="absolute bottom-2 size-1.5 rounded-full bg-current"
              aria-hidden="true"
            />
          </UButton>
        </div>
        <p class="mt-3 text-sm text-muted">
          Os pontos indicam encontros. Toque em um dia para consultar os detalhes abaixo.
        </p>
        <UButton
          v-if="selectedDate"
          class="mt-3"
          color="neutral"
          variant="outline"
          label="Ver todos os encontros do mês"
          @click="selectedDate = ''"
        />
      </UCard>
      <UAlert
        v-if="reminders.errorMessage.value"
        class="mb-4"
        color="error"
        variant="soft"
        title="Preferências de aviso"
        :description="reminders.errorMessage.value"
        :actions="[{ label: 'Atualizar preferências', onClick: reminders.load }]"
      />
      <div class="mb-5 rounded-xl border border-default p-4">
        <p class="text-sm text-muted">
          Você pode guardar uma preferência de aviso na sua conta. Para receber um alerta no celular, adicione o arquivo ao seu calendário e confirme a importação. Este app ainda não envia lembretes por push.
        </p>
        <UFormField
          class="mt-3 max-w-xs"
          label="Antecedência do aviso no calendário"
        >
          <USelect
            v-model="lead"
            :items="leadItems"
            class="w-full"
          />
        </UFormField>
      </div>
      <section
        class="space-y-4"
        aria-live="polite"
        aria-label="Encontros encontrados"
      >
        <UCard
          v-for="event in visibleEvents"
          :key="event.id"
        >
          <div class="flex flex-col justify-between gap-5 lg:flex-row">
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <h3 class="text-lg font-semibold">
                  {{ event.title }}
                </h3><UBadge
                  color="neutral"
                  variant="subtle"
                  :label="eventKindLabels[event.kind]"
                />
              </div>
              <p class="mt-2 font-medium text-primary">
                {{ formatAgendaDate(event.starts_at) }}
              </p>
              <p class="mt-1 text-sm text-muted">
                <UIcon name="i-lucide-map-pin" /> {{ event.location || 'Local a confirmar com a equipe' }}
              </p>
              <p
                v-if="event.description"
                class="mt-3 whitespace-pre-line text-sm leading-6 text-muted"
              >
                {{ event.description }}
              </p>
            </div>
            <div class="flex shrink-0 flex-col gap-2 lg:w-56">
              <UButton
                color="neutral"
                variant="outline"
                icon="i-lucide-calendar-plus"
                label="Adicionar ao calendário"
                @click="downloadEventCalendar(event, lead)"
              />
              <UButton
                v-if="Date.parse(event.starts_at) > Date.now()"
                :loading="reminders.savingId.value === event.id"
                :disabled="!reminders.ready.value || Boolean(reminders.savingId.value)"
                :variant="reminders.hasReminder(event.id) ? 'soft' : 'outline'"
                :icon="reminders.hasReminder(event.id) ? 'i-lucide-bookmark-check' : 'i-lucide-bookmark'"
                :label="reminders.hasReminder(event.id) ? 'Remover preferência' : 'Guardar preferência'"
                @click="reminders.toggle(event, lead)"
              />
              <p
                v-if="reminders.hasReminder(event.id)"
                class="text-xs text-muted"
                role="status"
              >
                Preferência salva na sua conta.
              </p>
            </div>
          </div>
        </UCard>
        <UCard
          v-if="!visibleEvents.length"
          class="py-6 text-center"
        >
          <UIcon
            name="i-lucide-calendar-x-2"
            class="size-9 text-muted"
          />
          <h3 class="mt-3 font-semibold">
            Nenhum encontro publicado {{ selectedDate && view === 'month' ? 'neste dia' : 'neste mês e filtro' }}
          </h3>
          <p class="mt-2 text-sm text-muted">
            Consulte outro mês ou fale com a equipe para confirmar a programação.
          </p>
          <UButton
            v-if="filter !== 'all'"
            class="mt-4"
            color="neutral"
            variant="outline"
            label="Mostrar todos os tipos"
            @click="filter = 'all'"
          />
          <UButton
            class="mt-4"
            to="/contato"
            variant="link"
            label="Falar com a CEDA"
          />
        </UCard>
      </section>
    </template>
  </div>
</template>
