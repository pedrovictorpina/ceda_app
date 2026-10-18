import type { ReminderLead } from '~/types/domain'
import type { AgendaEvent } from '~/utils/churchAgenda'
import { reminderDate } from '../utils/churchAgenda'

interface EventReminder { event_id: string, lead: ReminderLead, scheduled_for: string, cancelled_at: string | null }

export function useEventReminders() {
  const auth = useAuthStore()
  const reminders = ref<EventReminder[]>([])
  const loading = ref(true)
  const ready = ref(false)
  const savingId = ref('')
  const errorMessage = ref('')
  const hasReminder = (id: string) => reminders.value.some(row => row.event_id === id && !row.cancelled_at)
  let sessionVersion = 0
  let loadVersion = 0
  let saveVersion = 0
  const current = (userId: string, version: number) => (auth.profile?.id || '') === userId && version === sessionVersion

  async function load() {
    const userId = auth.profile?.id || ''
    const version = sessionVersion
    const request = ++loadVersion
    const active = () => current(userId, version) && request === loadVersion
    loading.value = true
    ready.value = false
    errorMessage.value = ''
    try {
      const { $supabase } = useNuxtApp()
      if (!$supabase || !userId) throw new Error('unavailable')
      const { data, error } = await $supabase.from('event_reminders').select('event_id, lead, scheduled_for, cancelled_at').eq('user_id', userId)
      if (!active()) return
      if (error) throw error
      reminders.value = (data || []) as EventReminder[]
      ready.value = true
    } catch {
      if (active()) errorMessage.value = 'Não foi possível consultar suas preferências de aviso. Tente novamente antes de alterá-las.'
    } finally {
      if (active()) loading.value = false
    }
  }

  async function toggle(event: AgendaEvent, lead: ReminderLead) {
    if (savingId.value || loading.value || !ready.value) return
    const { $supabase } = useNuxtApp()
    if (!$supabase || !auth.profile) {
      errorMessage.value = 'Sua sessão não está disponível. Entre novamente para guardar a preferência.'
      return
    }
    const userId = auth.profile.id
    const version = sessionVersion
    const request = ++saveVersion
    const active = () => current(userId, version) && request === saveVersion
    const removing = hasReminder(event.id)
    if (!removing && Date.parse(reminderDate(event.starts_at, lead)) <= Date.now()) {
      errorMessage.value = 'Esse horário de aviso já passou. Escolha um intervalo menor ou adicione o evento ao seu calendário.'
      return
    }
    savingId.value = event.id
    errorMessage.value = ''
    try {
      const result = removing
        ? await $supabase.from('event_reminders').delete().eq('event_id', event.id).eq('user_id', userId)
        : await $supabase.from('event_reminders').upsert({ event_id: event.id, user_id: userId, lead, scheduled_for: reminderDate(event.starts_at, lead), cancelled_at: null }, { onConflict: 'event_id,user_id,lead' })
      if (!active()) return
      if (result.error) throw result.error
      if (removing) reminders.value = reminders.value.filter(row => row.event_id !== event.id)
      else reminders.value.push({ event_id: event.id, lead, scheduled_for: reminderDate(event.starts_at, lead), cancelled_at: null })
    } catch {
      if (active()) errorMessage.value = 'Sua preferência não foi alterada. Confira a conexão e tente novamente.'
    } finally {
      if (active()) savingId.value = ''
    }
  }

  watch(() => auth.profile?.id, (userId) => {
    sessionVersion += 1
    loadVersion += 1
    saveVersion += 1
    reminders.value = []
    loading.value = false
    ready.value = false
    savingId.value = ''
    errorMessage.value = ''
    if (userId) void load()
  }, { flush: 'sync' })

  return { reminders, loading, ready, savingId, errorMessage, hasReminder, load, toggle }
}
