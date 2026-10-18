interface SavedMessage {
  id: string
  slug: string
  title: string
  content: string
  message_date: string
}

export function useSavedMessages() {
  const auth = useAuthStore()
  const messages = ref<SavedMessage[]>([])
  const loading = ref(true)
  const saving = ref(false)
  const errorMessage = ref('')
  const isSaved = (slug: string) => messages.value.some(message => message.slug === slug)
  let sessionVersion = 0
  let loadVersion = 0
  const current = (userId: string, version: number) => auth.profile?.id === userId && version === sessionVersion

  async function load() {
    if (saving.value) return
    const request = ++loadVersion
    const version = sessionVersion
    loading.value = true
    errorMessage.value = ''
    const userId = auth.profile?.id
    const { $supabase } = useNuxtApp()
    if (!$supabase || !userId) {
      errorMessage.value = 'Entre na sua conta para consultar suas mensagens salvas.'
      loading.value = false
      return
    }
    try {
      const { data, error } = await $supabase.from('saved_messages')
        .select('message:daily_messages!inner(id, slug, title, content, message_date)')
        .eq('user_id', userId).eq('message.status', 'published').eq('message.content_type', 'word_of_day')
        .or(`publish_at.is.null,publish_at.lte.${new Date().toISOString()}`, { referencedTable: 'message' })
        .order('created_at', { ascending: false })
      if (error) throw error
      if (!current(userId, version) || request !== loadVersion) return
      messages.value = (data || []).flatMap((row) => {
        const item = row.message as unknown as SavedMessage | SavedMessage[] | null
        return item ? (Array.isArray(item) ? item : [item]) : []
      })
    } catch {
      if (current(userId, version) && request === loadVersion) errorMessage.value = 'Não foi possível consultar suas mensagens salvas. Verifique a conexão e tente novamente.'
    } finally {
      if (current(userId, version) && request === loadVersion) loading.value = false
    }
  }

  async function toggle(slug: string) {
    if (saving.value || loading.value) return
    saving.value = true
    errorMessage.value = ''
    const { $supabase } = useNuxtApp()
    const userId = auth.profile?.id
    const version = sessionVersion
    try {
      if (!$supabase || !userId) throw new Error('session')
      const saved = messages.value.find(message => message.slug === slug)
      if (saved) {
        const { error } = await $supabase.from('saved_messages').delete().eq('user_id', userId).eq('message_id', saved.id)
        if (error) throw error
        if (current(userId, version)) messages.value = messages.value.filter(message => message.id !== saved.id)
      } else {
        const { data: message, error: messageError } = await $supabase.from('daily_messages')
          .select('id, slug, title, content, message_date').eq('slug', slug)
          .eq('content_type', 'word_of_day').eq('status', 'published')
          .or(`publish_at.is.null,publish_at.lte.${new Date().toISOString()}`).single()
        if (messageError || !message) throw messageError || new Error('message')
        if (!current(userId, version)) return
        const { error } = await $supabase.from('saved_messages').insert({ user_id: userId, message_id: message.id })
        if (error && error.code !== '23505') throw error
        if (current(userId, version)) messages.value = [message as SavedMessage, ...messages.value.filter(item => item.id !== message.id)]
      }
    } catch {
      if (userId && current(userId, version)) errorMessage.value = 'Não foi possível atualizar suas mensagens salvas. Tente novamente; sua escolha ainda não foi confirmada.'
    } finally {
      if (version === sessionVersion) saving.value = false
    }
  }

  watch(() => auth.profile?.id, (userId) => {
    sessionVersion++
    loadVersion++
    messages.value = []
    errorMessage.value = ''
    saving.value = false
    loading.value = false
    if (userId) void load()
  }, { flush: 'sync' })
  return { messages, isSaved, loading, saving, errorMessage, load, toggle }
}
