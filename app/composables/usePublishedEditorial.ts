export type EditorialContentType = 'word_of_day' | 'news'

export interface PublishedEditorialItem {
  id: string
  title: string
  content: string
  content_type: EditorialContentType
  slug: string
  message_date: string
  publish_at: string | null
}

export function usePublishedEditorial() {
  const loading = ref(true)
  const errorMessage = ref('')

  async function read<T>(query: () => PromiseLike<{ data: unknown, error: unknown }>, fallback: T): Promise<T> {
    loading.value = true
    errorMessage.value = ''
    try {
      const { data, error } = await query()
      if (error) throw error
      return (data ?? fallback) as T
    } catch {
      errorMessage.value = 'Não foi possível carregar as publicações. Confira sua conexão e tente novamente.'
      return fallback
    } finally { loading.value = false }
  }

  function published(type: EditorialContentType) {
    const { $supabase } = useNuxtApp()
    if (!$supabase) throw new Error('unavailable')
    return $supabase.from('daily_messages')
      .select('id, title, content, content_type, slug, message_date, publish_at')
      .eq('content_type', type).eq('status', 'published')
      .not('slug', 'is', null)
      .or(`publish_at.is.null,publish_at.lte.${new Date().toISOString()}`)
  }

  async function latest(type: EditorialContentType) {
    return read<PublishedEditorialItem | null>(() => published(type)
      .order('message_date', { ascending: false })
      .limit(1)
      .maybeSingle(), null)
  }

  async function list(type: EditorialContentType) {
    return read<PublishedEditorialItem[]>(() => published(type)
      .order('message_date', { ascending: false })
      .limit(100), [])
  }

  async function bySlug(type: EditorialContentType, slug: string) {
    return read<PublishedEditorialItem | null>(() => published(type)
      .eq('slug', slug)
      .maybeSingle(), null)
  }

  return { latest, list, bySlug, loading, errorMessage }
}
