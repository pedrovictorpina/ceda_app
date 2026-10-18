export interface InternalNotification {
  id: string
  title: string
  body: string
  deep_link: string | null
  read_at: string | null
  created_at: string
  source_cell_id: string | null
}

export function useInternalNotifications() {
  const auth = useAuthStore()
  const notifications = ref<InternalNotification[]>([])
  const loading = ref(true)
  const errorMessage = ref('')
  const markingId = ref('')
  const hasMore = ref(false)
  const confirmedReads = new Map<string, string>()
  let nextOffset = 0
  let loadPending = false
  let generation = 0
  let disposed = false
  const belongsTo = (userId: string) => !disposed && auth.profile?.id === userId

  watch(() => auth.profile?.id, () => {
    ++generation
    notifications.value = []
    confirmedReads.clear()
    nextOffset = 0
    loadPending = false
    hasMore.value = false
    errorMessage.value = 'Seu acesso mudou. Atualize a lista para consultar os avisos desta conta.'
    loading.value = false
  }, { flush: 'sync' })
  onBeforeUnmount(() => {
    disposed = true
  })

  async function load(more = false) {
    if (loadPending) return
    const userId = auth.profile?.id
    const requestGeneration = generation
    const offset = more ? nextOffset : 0
    loadPending = true
    loading.value = true
    errorMessage.value = ''
    try {
      const { $supabase } = useNuxtApp()
      if (!$supabase || !userId) throw new Error('session')
      const { data, error } = await $supabase.from('notifications')
        .select('id, title, body, deep_link, read_at, created_at, source_cell_id')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .range(offset, offset + 49)
      if (error) throw error
      if (!belongsTo(userId) || requestGeneration !== generation) return
      const rows: InternalNotification[] = (data || []).map(item => ({ ...item, read_at: item.read_at || confirmedReads.get(item.id) || null }))
      notifications.value = more ? [...notifications.value, ...rows.filter(item => !notifications.value.some(existing => existing.id === item.id))] : rows
      nextOffset = offset + rows.length
      hasMore.value = rows.length === 50
    } catch {
      if (requestGeneration === generation && (!userId || belongsTo(userId))) errorMessage.value = 'Não foi possível atualizar seus avisos. Verifique a conexão e tente novamente; os avisos já carregados foram mantidos.'
    } finally {
      if (requestGeneration === generation) {
        loadPending = false
        loading.value = false
      }
    }
  }

  async function markRead(notification: InternalNotification) {
    if (notification.read_at || markingId.value) return
    const userId = auth.profile?.id
    const requestGeneration = generation
    markingId.value = notification.id
    errorMessage.value = ''
    try {
      const { $supabase } = useNuxtApp()
      if (!$supabase || !userId) throw new Error('session')
      const readAt = new Date().toISOString()
      const { data, error } = await $supabase.from('notifications').update({ read_at: readAt }).eq('id', notification.id).eq('user_id', userId).select('id').single()
      if (error || data?.id !== notification.id) throw error || new Error('not-updated')
      if (!belongsTo(userId) || requestGeneration !== generation) return
      confirmedReads.set(notification.id, readAt)
      const current = notifications.value.find(item => item.id === notification.id)
      if (current) current.read_at = readAt
    } catch {
      if (requestGeneration === generation && (!userId || belongsTo(userId))) errorMessage.value = 'Não foi possível marcar o aviso como lido. Ele continua como não lido; tente novamente.'
    } finally { markingId.value = '' }
  }

  return { notifications, loading, errorMessage, markingId, hasMore, load, markRead }
}
