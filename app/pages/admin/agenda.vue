<script setup lang="ts">
import type { EventKind, ReminderLead } from '~/types/domain'

definePageMeta({ layout: 'admin', middleware: ['auth', 'admin'] })
useSeoMeta({ title: 'Agenda e eventos' })

interface ChurchEvent {
  id: string
  title: string
  kind: EventKind
  starts_at: string
  ends_at: string | null
  location: string | null
  description: string | null
  responsible_id: string
  community_id: string | null
  ministry_id: string | null
  cancelled_at: string | null
  created_at: string
}

interface ProfileOption {
  id: string
  full_name: string
  email: string
}

interface ReminderRow {
  event_id: string
  lead: ReminderLead
  scheduled_for: string
  cancelled_at: string | null
}

const auth = useAuthStore()
const loading = ref(true)
const saving = ref(false)
const editorOpen = ref(false)
const editingId = ref<string | null>(null)
const feedback = ref('')
const errorMessage = ref('')
const events = ref<ChurchEvent[]>([])
const profiles = ref<ProfileOption[]>([])
const reminders = ref<ReminderRow[]>([])
const showCancelled = ref(false)

const form = reactive({
  title: '',
  kind: 'event' as EventKind,
  startsAt: '',
  endsAt: '',
  location: '',
  description: '',
  responsibleId: '',
  remindWeek: false,
  remindDay: true,
  remindHour: false
})

const kindItems = [
  { label: 'Culto', value: 'service' },
  { label: 'Evento', value: 'event' },
  { label: 'Reunião', value: 'meeting' },
  { label: 'Ensaio', value: 'rehearsal' },
  { label: 'Atividade', value: 'activity' }
]
const kindLabels: Record<EventKind, string> = {
  service: 'Culto',
  event: 'Evento',
  meeting: 'Reunião',
  rehearsal: 'Ensaio',
  activity: 'Atividade'
}
const reminderLabels: Record<ReminderLead, string> = {
  week: '1 semana antes',
  day: '1 dia antes',
  hour: '1 hora antes'
}

const responsibleItems = computed(() => profiles.value.map(profile => ({
  label: `${profile.full_name} — ${profile.email}`,
  value: profile.id
})))
const responsibleById = computed(() => new Map(profiles.value.map(profile => [profile.id, profile])))
const remindersByEvent = computed(() => {
  const grouped = new Map<string, ReminderRow[]>()
  for (const reminder of reminders.value) {
    if (reminder.cancelled_at) continue
    grouped.set(reminder.event_id, [...(grouped.get(reminder.event_id) || []), reminder])
  }
  return grouped
})
const visibleEvents = computed(() => events.value.filter(event => showCancelled.value || !event.cancelled_at))
const activeEvents = computed(() => events.value.filter(event => !event.cancelled_at))
const upcomingEvents = computed(() => activeEvents.value.filter(event => new Date(event.starts_at).getTime() >= Date.now()))
const activeReminders = computed(() => reminders.value.filter(reminder => !reminder.cancelled_at))

function toLocalInput(value: string | null) {
  if (!value) return ''
  const date = new Date(value)
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  }).format(new Date(value))
}

function selectedReminderLeads(): ReminderLead[] {
  return [
    form.remindWeek ? 'week' : null,
    form.remindDay ? 'day' : null,
    form.remindHour ? 'hour' : null
  ].filter((lead): lead is ReminderLead => Boolean(lead))
}

function reminderSchedule(startsAt: string, lead: ReminderLead) {
  const date = new Date(startsAt)
  const milliseconds = lead === 'week' ? 7 * 24 * 60 * 60 * 1000 : lead === 'day' ? 24 * 60 * 60 * 1000 : 60 * 60 * 1000
  return new Date(date.getTime() - milliseconds).toISOString()
}

function resetForm() {
  editingId.value = null
  Object.assign(form, {
    title: '',
    kind: 'event',
    startsAt: '',
    endsAt: '',
    location: '',
    description: '',
    responsibleId: auth.profile?.id || '',
    remindWeek: false,
    remindDay: true,
    remindHour: false
  })
}

function openCreate() {
  resetForm()
  feedback.value = ''
  errorMessage.value = ''
  editorOpen.value = true
}

function editEvent(event: ChurchEvent) {
  const eventReminderLeads = new Set((remindersByEvent.value.get(event.id) || []).map(reminder => reminder.lead))
  editingId.value = event.id
  Object.assign(form, {
    title: event.title,
    kind: event.kind,
    startsAt: toLocalInput(event.starts_at),
    endsAt: toLocalInput(event.ends_at),
    location: event.location || '',
    description: event.description || '',
    responsibleId: event.responsible_id,
    remindWeek: eventReminderLeads.has('week'),
    remindDay: eventReminderLeads.has('day'),
    remindHour: eventReminderLeads.has('hour')
  })
  feedback.value = ''
  errorMessage.value = ''
  editorOpen.value = true
}

async function loadAgenda() {
  const { $supabase } = useNuxtApp()
  if (!$supabase || !auth.profile) {
    errorMessage.value = 'O serviço de dados ou a sessão atual não está disponível.'
    loading.value = false
    return
  }

  loading.value = true
  errorMessage.value = ''
  const [eventsResult, profilesResult, remindersResult] = await Promise.all([
    $supabase.from('events').select('id, title, kind, starts_at, ends_at, location, description, responsible_id, community_id, ministry_id, cancelled_at, created_at').order('starts_at', { ascending: true }).limit(250),
    $supabase.from('profiles').select('id, full_name, email').order('full_name', { ascending: true }).limit(250),
    $supabase.from('event_reminders').select('event_id, lead, scheduled_for, cancelled_at').eq('user_id', auth.profile.id)
  ])

  if (eventsResult.error || profilesResult.error || remindersResult.error) {
    errorMessage.value = 'Não foi possível carregar toda a agenda. Confirme as permissões da sua sessão e tente novamente.'
  }
  events.value = (eventsResult.data || []) as ChurchEvent[]
  profiles.value = (profilesResult.data || []) as ProfileOption[]
  reminders.value = (remindersResult.data || []) as ReminderRow[]
  loading.value = false
}

async function saveOwnReminders(eventId: string, startsAt: string) {
  const { $supabase } = useNuxtApp()
  if (!$supabase || !auth.profile) return { error: new Error('Sessão indisponível') }

  const deleteResult = await $supabase.from('event_reminders').delete().eq('event_id', eventId).eq('user_id', auth.profile.id)
  if (deleteResult.error) return deleteResult

  const leads = selectedReminderLeads()
  if (!leads.length) return { error: null }
  return $supabase.from('event_reminders').insert(leads.map(lead => ({
    event_id: eventId,
    user_id: auth.profile!.id,
    lead,
    scheduled_for: reminderSchedule(startsAt, lead)
  })))
}

async function saveEvent() {
  if (!auth.profile || !form.title.trim() || !form.startsAt || !form.responsibleId) {
    errorMessage.value = 'Informe título, início e responsável antes de salvar.'
    return
  }
  const startsAt = new Date(form.startsAt)
  const endsAt = form.endsAt ? new Date(form.endsAt) : null
  if (Number.isNaN(startsAt.getTime()) || (endsAt && Number.isNaN(endsAt.getTime()))) {
    errorMessage.value = 'Informe datas e horários válidos.'
    return
  }
  if (endsAt && endsAt.getTime() < startsAt.getTime()) {
    errorMessage.value = 'O término não pode acontecer antes do início.'
    return
  }

  const { $supabase } = useNuxtApp()
  if (!$supabase) return
  saving.value = true
  errorMessage.value = ''
  feedback.value = ''
  const payload = {
    title: form.title.trim(),
    kind: form.kind,
    starts_at: startsAt.toISOString(),
    ends_at: endsAt?.toISOString() || null,
    location: form.location.trim() || null,
    description: form.description.trim() || null,
    responsible_id: form.responsibleId
  }

  let eventId = editingId.value
  if (eventId) {
    const { error } = await $supabase.from('events').update(payload).eq('id', eventId)
    if (error) {
      saving.value = false
      errorMessage.value = 'Não foi possível atualizar o evento.'
      return
    }
  } else {
    const { data, error } = await $supabase.from('events').insert(payload).select('id').single()
    if (error || !data) {
      saving.value = false
      errorMessage.value = 'Não foi possível criar o evento.'
      return
    }
    eventId = data.id
  }

  if (!eventId) {
    saving.value = false
    errorMessage.value = 'Não foi possível identificar o evento salvo para configurar os lembretes.'
    return
  }
  const remindersResult = await saveOwnReminders(eventId, startsAt.toISOString())
  saving.value = false
  if (remindersResult.error) {
    errorMessage.value = 'O evento foi salvo, mas os seus lembretes não puderam ser atualizados.'
    await loadAgenda()
    return
  }

  editorOpen.value = false
  feedback.value = editingId.value ? 'Evento e seus lembretes pessoais foram atualizados.' : 'Evento criado e lembretes pessoais configurados.'
  await loadAgenda()
}

async function cancelEvent(event: ChurchEvent) {
  const { $supabase } = useNuxtApp()
  if (!$supabase) return
  saving.value = true
  errorMessage.value = ''
  feedback.value = ''
  const { error } = await $supabase.from('events').update({ cancelled_at: new Date().toISOString() }).eq('id', event.id).is('cancelled_at', null)
  saving.value = false
  if (error) {
    errorMessage.value = 'Não foi possível cancelar este evento.'
    return
  }
  feedback.value = 'Evento cancelado. O registro foi mantido na agenda administrativa.'
  await loadAgenda()
}

onMounted(loadAgenda)
</script>

<template>
  <div>
    <PageIntro
      title="Agenda e eventos"
      description="Organize a programação da igreja, defina responsáveis e mantenha lembretes pessoais para os próximos compromissos."
      icon="i-lucide-calendar-cog"
    />

    <UAlert
      color="primary"
      variant="subtle"
      title="Lembretes respeitam a privacidade"
      description="Esta tela mostra e gerencia somente os seus lembretes. Responsáveis e eventos usam as permissões já protegidas pelo banco."
    />

    <UAlert
      v-if="errorMessage || feedback"
      class="mt-5"
      :color="errorMessage ? 'error' : 'success'"
      variant="subtle"
      :title="errorMessage ? 'Não foi possível concluir' : 'Agenda atualizada'"
      :description="errorMessage || feedback"
    />

    <section class="mt-6 grid gap-4 sm:grid-cols-3">
      <UCard>
        <UIcon
          name="i-lucide-calendar-days"
          class="size-6 text-primary"
        />
        <p class="mt-4 text-3xl font-bold">
          {{ loading ? '—' : activeEvents.length }}
        </p>
        <p class="mt-1 text-sm text-muted">
          Eventos ativos
        </p>
      </UCard>
      <UCard>
        <UIcon
          name="i-lucide-calendar-clock"
          class="size-6 text-primary"
        />
        <p class="mt-4 text-3xl font-bold">
          {{ loading ? '—' : upcomingEvents.length }}
        </p>
        <p class="mt-1 text-sm text-muted">
          Próximos eventos
        </p>
      </UCard>
      <UCard>
        <UIcon
          name="i-lucide-bell-ring"
          class="size-6 text-primary"
        />
        <p class="mt-4 text-3xl font-bold">
          {{ loading ? '—' : activeReminders.length }}
        </p>
        <p class="mt-1 text-sm text-muted">
          Seus lembretes ativos
        </p>
      </UCard>
    </section>

    <section
      class="mt-8"
      aria-labelledby="events-title"
    >
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p class="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
            Programação
          </p>
          <h2
            id="events-title"
            class="mt-1 text-2xl font-bold"
          >
            Eventos da comunidade
          </h2>
        </div>
        <div class="flex flex-wrap gap-2">
          <UButton
            color="neutral"
            variant="outline"
            icon="i-lucide-refresh-cw"
            label="Atualizar"
            :loading="loading"
            @click="loadAgenda"
          />
          <UButton
            icon="i-lucide-plus"
            label="Novo evento"
            @click="openCreate"
          />
        </div>
      </div>

      <UCheckbox
        v-model="showCancelled"
        class="mt-4"
        label="Mostrar eventos cancelados"
      />

      <div
        v-if="loading"
        class="mt-5 grid gap-4 lg:grid-cols-2"
      >
        <USkeleton
          v-for="index in 4"
          :key="index"
          class="h-64 rounded-xl"
        />
      </div>
      <div
        v-else-if="visibleEvents.length"
        class="mt-5 grid gap-4 lg:grid-cols-2"
      >
        <UCard
          v-for="event in visibleEvents"
          :key="event.id"
          :class="event.cancelled_at ? 'opacity-70' : ''"
        >
          <div class="flex flex-wrap items-center gap-2">
            <UBadge
              color="neutral"
              variant="subtle"
              :label="kindLabels[event.kind]"
            />
            <UBadge
              v-if="event.cancelled_at"
              color="error"
              variant="subtle"
              label="Cancelado"
            />
            <UBadge
              v-else
              color="primary"
              variant="subtle"
              label="Ativo"
            />
          </div>
          <h3 class="mt-4 text-lg font-semibold">
            {{ event.title }}
          </h3>
          <p class="mt-2 flex items-start gap-2 text-sm leading-6 text-muted">
            <UIcon
              name="i-lucide-calendar-clock"
              class="mt-0.5 size-4 shrink-0"
            />
            <span>{{ formatDate(event.starts_at) }}<template v-if="event.ends_at"> até {{ formatDate(event.ends_at) }}</template></span>
          </p>
          <p
            v-if="event.location"
            class="mt-2 flex items-start gap-2 text-sm leading-6 text-muted"
          >
            <UIcon
              name="i-lucide-map-pin"
              class="mt-0.5 size-4 shrink-0"
            />
            <span>{{ event.location }}</span>
          </p>
          <p class="mt-2 flex items-start gap-2 text-sm leading-6 text-muted">
            <UIcon
              name="i-lucide-user-round"
              class="mt-0.5 size-4 shrink-0"
            />
            <span>Responsável: {{ responsibleById.get(event.responsible_id)?.full_name || 'Não disponível' }}</span>
          </p>
          <p
            v-if="event.description"
            class="mt-4 line-clamp-3 whitespace-pre-line text-sm leading-6 text-muted"
          >
            {{ event.description }}
          </p>
          <div
            v-if="remindersByEvent.get(event.id)?.length"
            class="mt-4 flex flex-wrap gap-2"
          >
            <UBadge
              v-for="reminder in remindersByEvent.get(event.id)"
              :key="reminder.lead"
              color="neutral"
              variant="subtle"
              :label="`Seu lembrete: ${reminderLabels[reminder.lead]}`"
            />
          </div>
          <template #footer>
            <div class="flex flex-wrap items-center justify-between gap-3">
              <p class="text-xs text-muted">
                Criado em {{ formatDate(event.created_at) }}
              </p>
              <div
                v-if="!event.cancelled_at"
                class="flex gap-2"
              >
                <UButton
                  size="sm"
                  color="neutral"
                  variant="outline"
                  icon="i-lucide-pencil"
                  label="Editar"
                  @click="editEvent(event)"
                />
                <UButton
                  size="sm"
                  color="error"
                  variant="outline"
                  icon="i-lucide-ban"
                  label="Cancelar"
                  :loading="saving"
                  @click="cancelEvent(event)"
                />
              </div>
            </div>
          </template>
        </UCard>
      </div>
      <UCard
        v-else
        class="mt-5"
      >
        <div class="py-8 text-center">
          <UIcon
            name="i-lucide-calendar-plus"
            class="mx-auto size-10 text-muted"
          />
          <h3 class="mt-3 font-semibold">
            Nenhum evento encontrado
          </h3>
          <p class="mt-1 text-sm text-muted">
            Crie o primeiro evento da programação da CEDA.
          </p>
          <UButton
            class="mt-5"
            label="Criar evento"
            @click="openCreate"
          />
        </div>
      </UCard>
    </section>

    <UModal
      v-model:open="editorOpen"
      :title="editingId ? 'Editar evento' : 'Novo evento'"
      description="Os lembretes abaixo pertencem somente à sua conta."
    >
      <template #body>
        <form
          class="grid gap-4"
          @submit.prevent="saveEvent"
        >
          <div class="grid gap-4 sm:grid-cols-2">
            <UFormField
              label="Tipo"
              required
            >
              <USelect
                v-model="form.kind"
                :items="kindItems"
                class="w-full"
              />
            </UFormField>
            <UFormField
              label="Responsável"
              required
            >
              <USelect
                v-model="form.responsibleId"
                :items="responsibleItems"
                class="w-full"
              />
            </UFormField>
          </div>
          <UFormField
            label="Título"
            required
          >
            <UInput
              v-model="form.title"
              class="w-full"
              placeholder="Ex.: Culto de celebração"
            />
          </UFormField>
          <div class="grid gap-4 sm:grid-cols-2">
            <UFormField
              label="Início"
              required
            >
              <UInput
                v-model="form.startsAt"
                type="datetime-local"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Término">
              <UInput
                v-model="form.endsAt"
                type="datetime-local"
                class="w-full"
              />
            </UFormField>
          </div>
          <UFormField label="Local">
            <UInput
              v-model="form.location"
              class="w-full"
              placeholder="Ex.: Sede CEDA"
            />
          </UFormField>
          <UFormField label="Descrição">
            <UTextarea
              v-model="form.description"
              :rows="5"
              class="w-full"
              placeholder="Informações importantes para a comunidade."
            />
          </UFormField>
          <fieldset class="rounded-xl border border-default p-4">
            <legend class="px-1 text-sm font-semibold">
              Meus lembretes
            </legend>
            <p class="text-sm text-muted">
              Eles serão salvos apenas para a sua conta.
            </p>
            <div class="mt-3 grid gap-2 sm:grid-cols-3">
              <UCheckbox
                v-model="form.remindWeek"
                label="1 semana antes"
              />
              <UCheckbox
                v-model="form.remindDay"
                label="1 dia antes"
              />
              <UCheckbox
                v-model="form.remindHour"
                label="1 hora antes"
              />
            </div>
          </fieldset>
          <div class="flex flex-wrap justify-end gap-2 pt-2">
            <UButton
              type="button"
              color="neutral"
              variant="outline"
              label="Cancelar"
              @click="editorOpen = false"
            />
            <UButton
              type="submit"
              :loading="saving"
              :label="editingId ? 'Salvar alterações' : 'Criar evento'"
            />
          </div>
        </form>
      </template>
    </UModal>
  </div>
</template>
