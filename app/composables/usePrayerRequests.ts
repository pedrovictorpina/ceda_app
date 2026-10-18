export type PrayerVisibility = 'private' | 'pastoral' | 'community'
export interface PrayerDraft { title: string, details: string, visibility: PrayerVisibility }
export interface PrayerItem extends PrayerDraft { id: string, status: 'active' | 'answered', createdAt: string }

interface PrayerRow { id: string, title: string, details: string | null, visibility: PrayerVisibility, status: string, created_at: string }
const columns = 'id, title, details, visibility, status, created_at'

function prayerItem(row: PrayerRow): PrayerItem {
  const date = new Date(row.created_at)
  return {
    id: row.id,
    title: row.title,
    details: row.details || '',
    visibility: row.visibility,
    status: row.status === 'answered' ? 'answered' : 'active',
    createdAt: Number.isNaN(date.valueOf()) ? 'Data indisponível' : new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(date)
  }
}

export function usePrayerRequests() {
  const auth = useAuthStore()
  const requests = ref<PrayerItem[]>([])
  const loading = ref(true)
  const saving = ref(false)
  const loadError = ref('')
  const actionError = ref('')
  let loadId = 0
  let revision = 0
  let disposed = false
  const belongsTo = (userId: string) => !disposed && auth.profile?.id === userId

  watch(() => auth.profile?.id, () => {
    ++loadId
    ++revision
    requests.value = []
    loading.value = false
    loadError.value = 'Seu acesso mudou. Atualize a lista para consultar os pedidos desta conta.'
    actionError.value = ''
  }, { flush: 'sync' })
  onBeforeUnmount(() => {
    disposed = true
  })

  async function load() {
    if (saving.value) return
    const requestId = ++loadId
    const requestRevision = revision
    const userId = auth.profile?.id
    loading.value = true
    loadError.value = ''
    try {
      const { $supabase } = useNuxtApp()
      if (!$supabase || !userId) throw new Error('session')
      const { data, error } = await $supabase.from('prayer_requests').select(columns).eq('author_id', userId).neq('status', 'archived').order('created_at', { ascending: false })
      if (error) throw error
      if (belongsTo(userId) && requestId === loadId && requestRevision === revision) requests.value = (data || []).map(prayerItem)
    } catch {
      if (userId && belongsTo(userId) && requestId === loadId) loadError.value = 'Não foi possível consultar seus pedidos. A lista pode estar desatualizada; tente novamente.'
      else if (!userId && requestId === loadId) loadError.value = 'Entre novamente para consultar seus pedidos. Seu acesso não está disponível nesta tela.'
    } finally { if (requestId === loadId) loading.value = false }
  }

  async function create(input: PrayerDraft): Promise<PrayerItem | null> {
    if (saving.value) return null
    const userId = auth.profile?.id
    const draft = { title: input.title.trim(), details: input.details.trim(), visibility: input.visibility }
    actionError.value = ''
    if (!draft.title) {
      actionError.value = 'Dê um título para reconhecer este pedido depois.'
      return null
    }
    saving.value = true
    ++revision
    try {
      const { $supabase } = useNuxtApp()
      if (!$supabase || !userId) throw new Error('session')
      const { data, error } = await $supabase.from('prayer_requests').insert({ author_id: userId, title: draft.title, details: draft.details || null, visibility: draft.visibility }).select(columns).single()
      if (error || !data?.id) throw error || new Error('not-created')
      if (!belongsTo(userId)) return null
      const item = prayerItem(data)
      requests.value = [item, ...requests.value.filter(existing => existing.id !== item.id)]
      return item
    } catch {
      if (!userId || belongsTo(userId)) actionError.value = 'Não foi possível salvar o pedido. Seu texto foi mantido nesta tela; verifique a conexão e tente novamente.'
      return null
    } finally { saving.value = false }
  }

  async function markAnswered(item: PrayerItem): Promise<boolean> {
    if (saving.value || item.status === 'answered') return false
    const userId = auth.profile?.id
    actionError.value = ''
    saving.value = true
    ++revision
    try {
      const { $supabase } = useNuxtApp()
      if (!$supabase || !userId) throw new Error('session')
      const { data, error } = await $supabase.from('prayer_requests').update({ status: 'answered' }).eq('id', item.id).eq('author_id', userId).select('id').single()
      if (error || data?.id !== item.id) throw error || new Error('not-updated')
      if (!belongsTo(userId)) return false
      const current = requests.value.find(existing => existing.id === item.id)
      if (current) current.status = 'answered'
      return true
    } catch {
      if (!userId || belongsTo(userId)) actionError.value = 'Não foi possível atualizar o pedido. A situação anterior foi mantida; tente novamente.'
      return false
    } finally { saving.value = false }
  }

  return { requests, loading, saving, loadError, actionError, load, create, markAnswered }
}
