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
  async function latest(type: EditorialContentType) {
    const { $supabase } = useNuxtApp()
    if (!$supabase) return null
    const { data } = await $supabase
      .from('daily_messages')
      .select('id, title, content, content_type, slug, message_date, publish_at')
      .eq('content_type', type)
      .eq('status', 'published')
      .order('message_date', { ascending: false })
      .limit(1)
      .maybeSingle()
    return data as PublishedEditorialItem | null
  }

  async function list(type: EditorialContentType) {
    const { $supabase } = useNuxtApp()
    if (!$supabase) return []
    const { data } = await $supabase
      .from('daily_messages')
      .select('id, title, content, content_type, slug, message_date, publish_at')
      .eq('content_type', type)
      .eq('status', 'published')
      .order('message_date', { ascending: false })
      .limit(100)
    return (data || []) as PublishedEditorialItem[]
  }

  async function bySlug(type: EditorialContentType, slug: string) {
    const { $supabase } = useNuxtApp()
    if (!$supabase) return null
    const { data } = await $supabase
      .from('daily_messages')
      .select('id, title, content, content_type, slug, message_date, publish_at')
      .eq('content_type', type)
      .eq('status', 'published')
      .eq('slug', slug)
      .maybeSingle()
    return data as PublishedEditorialItem | null
  }

  return { latest, list, bySlug }
}
