import type { AgendaEvent } from '~/utils/churchAgenda'

export function useChurchAgenda(publicOnly = false) {
  const auth = publicOnly ? null : useAuthStore()
  const events = ref<AgendaEvent[]>([])
  const loading = ref(true)
  const errorMessage = ref('')
  let request = 0
  let sessionVersion = 0
  let lastRange: [Date, Date] | null = null

  async function load(from = new Date(), to = new Date(from.getFullYear() + 1, from.getMonth(), from.getDate())) {
    const current = ++request
    const version = sessionVersion
    const userId = auth?.profile?.id || ''
    const active = () => current === request && (publicOnly || (version === sessionVersion && userId === (auth?.profile?.id || '')))
    lastRange = [from, to]
    loading.value = true
    errorMessage.value = ''
    try {
      const { $supabase } = useNuxtApp()
      if (!$supabase || (!publicOnly && !userId)) throw new Error('unavailable')
      let query = $supabase.from('events')
        .select('id, title, kind, starts_at, ends_at, location, description, cancelled_at, public_visibility')
        .is('cancelled_at', null).gte('starts_at', from.toISOString()).lt('starts_at', to.toISOString())
        .order('starts_at', { ascending: true }).limit(500)
      // Explicitly restrict visitors even if a member is already signed in.
      if (publicOnly) query = query.eq('public_visibility', true).eq('kind', 'service').is('community_id', null).is('ministry_id', null)
      const { data, error } = await query
      if (error) throw error
      if (active()) events.value = (data || []) as AgendaEvent[]
    } catch {
      if (active()) errorMessage.value = 'Não foi possível atualizar a agenda. Confira sua conexão e tente novamente.'
    } finally {
      if (active()) loading.value = false
    }
  }

  if (auth) {
    watch(() => auth.profile?.id, (userId) => {
      sessionVersion += 1
      request += 1
      events.value = []
      loading.value = false
      errorMessage.value = ''
      if (userId && lastRange) void load(...lastRange)
    }, { flush: 'sync' })
  }

  return { events, loading, errorMessage, load }
}
