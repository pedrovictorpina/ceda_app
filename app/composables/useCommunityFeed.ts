interface FeedPost {
  id: string
  author_id: string
  title: string
  description: string
  created_at: string
  author: { full_name: string } | null
  likes: Array<{ count: number }>
  comments: Array<{ count: number }>
}
interface FeedComment { id: string, author_id: string, content: string, created_at: string, author: { full_name: string } | null }
const postSelection = 'id, author_id, title, description, created_at, author:profiles!posts_author_id_fkey(full_name), likes:post_likes(count), comments:post_comments(count)'

export function useCommunityFeed() {
  const auth = useAuthStore()
  const posts = ref<FeedPost[]>([])
  const likedIds = ref<string[]>([])
  const comments = ref<FeedComment[]>([])
  const loading = ref(true)
  const commentsLoading = ref(false)
  const hasMore = ref(false)
  const busy = ref('')
  const errorMessage = ref('')
  const commentsError = ref('')
  const selectedId = ref('')
  let sessionVersion = 0
  let loadVersion = 0
  let commentsVersion = 0
  let nextOffset = 0

  function client() {
    const { $supabase } = useNuxtApp()
    if (!$supabase || !auth.profile) throw new Error('session')
    return $supabase
  }
  const current = (userId: string | undefined, version: number) => Boolean(userId) && auth.profile?.id === userId && version === sessionVersion
  function beginMutation(key: string) {
    busy.value = key
    // A response started before this write cannot overwrite its confirmed result.
    loadVersion++
    loading.value = false
  }
  async function load(more = false, targetId?: string) {
    if (busy.value) return
    const userId = auth.profile?.id
    const version = sessionVersion
    const request = ++loadVersion
    const valid = () => current(userId, version) && request === loadVersion
    loading.value = true
    errorMessage.value = ''
    try {
      const supabase = client()
      const offset = more ? nextOffset : 0
      const { data, error } = await supabase.from('posts').select(postSelection)
        .is('community_id', null).order('created_at', { ascending: false }).order('id').range(offset, offset + 19)
      if (error) throw error
      if (!valid()) return
      const rows = [...(data || [])] as unknown as FeedPost[]
      // A shared link must also open a post older than the first page.
      if (targetId && !rows.some(post => post.id === targetId)) {
        const target = await supabase.from('posts').select(postSelection).eq('id', targetId).is('community_id', null).maybeSingle()
        if (!valid()) return
        if (target.error) throw target.error
        if (target.data) rows.push(target.data as unknown as FeedPost)
        else errorMessage.value = 'A publicação compartilhada não está disponível. Ela pode ter sido removida ou ter acesso restrito.'
      }
      const ids = rows.map(post => post.id)
      const ownLikes = ids.length
        ? await supabase.from('post_likes').select('post_id')
            .eq('user_id', userId!).in('post_id', ids)
        : { data: [], error: null }
      if (ownLikes.error) throw ownLikes.error
      if (!valid()) return
      const previous = more ? posts.value : []
      posts.value = [...previous, ...rows.filter(row => !previous.some(post => post.id === row.id))]
      likedIds.value = [...new Set([...(more ? likedIds.value : []), ...(ownLikes.data || []).map(item => item.post_id)])]
      hasMore.value = (data || []).length === 20
      nextOffset = offset + (data || []).length
    } catch {
      if (valid()) errorMessage.value = 'Não foi possível atualizar as conversas. Verifique a conexão e tente novamente.'
    } finally {
      if (valid()) loading.value = false
    }
  }
  async function publish(title: string, description: string) {
    if (busy.value || !title.trim() || title.trim().length > 160 || !description.trim() || description.trim().length > 5000) return false
    const userId = auth.profile?.id
    const version = sessionVersion
    beginMutation('publish')
    errorMessage.value = ''
    try {
      const { data, error } = await client().from('posts').insert({ author_id: userId!, title: title.trim(), description: description.trim() }).select(postSelection).single()
      if (error || !data) throw error || new Error('post')
      if (!current(userId, version)) return false
      posts.value = [data as unknown as FeedPost, ...posts.value.filter(post => post.id !== data.id)]
      nextOffset++
      return true
    } catch {
      if (current(userId, version)) errorMessage.value = 'Não foi possível publicar. Seu texto foi mantido para você tentar novamente.'
      return false
    } finally {
      if (version === sessionVersion) busy.value = ''
    }
  }
  async function toggleLike(post: FeedPost) {
    if (busy.value) return
    const userId = auth.profile?.id
    const version = sessionVersion
    beginMutation(post.id)
    errorMessage.value = ''
    try {
      const supabase = client()
      const wasLiked = likedIds.value.includes(post.id)
      const result = wasLiked
        ? await supabase.from('post_likes').delete().eq('post_id', post.id).eq('user_id', userId!)
        : await supabase.from('post_likes').insert({ post_id: post.id, user_id: userId! })
      if (result.error && result.error.code !== '23505') throw result.error
      if (!current(userId, version)) return
      const { data, error } = await supabase.from('posts').select(postSelection).eq('id', post.id).single()
      if (!current(userId, version)) return
      const own = await supabase.from('post_likes').select('post_id').eq('post_id', post.id).eq('user_id', userId!).maybeSingle()
      if (error || own.error || !data) throw new Error('refresh')
      if (!current(userId, version)) return
      posts.value = posts.value.map(item => item.id === post.id ? data as unknown as FeedPost : item)
      likedIds.value = likedIds.value.filter(id => id !== post.id)
      if (own.data) likedIds.value.push(post.id)
    } catch {
      if (current(userId, version)) errorMessage.value = 'Não foi possível confirmar sua curtida. Atualize para conferir a situação antes de tentar novamente.'
    } finally {
      if (version === sessionVersion) busy.value = ''
    }
  }
  async function loadComments(postId: string) {
    const userId = auth.profile?.id
    const version = sessionVersion
    const request = ++commentsVersion
    const valid = () => current(userId, version) && selectedId.value === postId && request === commentsVersion
    selectedId.value = postId
    commentsLoading.value = true
    commentsError.value = ''
    comments.value = []
    try {
      const { data, error } = await client().from('post_comments')
        .select('id, author_id, content, created_at, author:profiles!post_comments_author_id_fkey(full_name)')
        .eq('post_id', postId).order('created_at', { ascending: false }).order('id').limit(50)
      if (error) throw error
      if (valid()) comments.value = (data || []) as unknown as FeedComment[]
    } catch {
      if (valid()) commentsError.value = 'Não foi possível carregar os comentários. Tente novamente.'
    } finally {
      if (valid()) commentsLoading.value = false
    }
  }
  async function comment(content: string) {
    if (busy.value || !selectedId.value || !content.trim() || content.trim().length > 2000) return false
    const postId = selectedId.value
    const userId = auth.profile?.id
    const version = sessionVersion
    beginMutation('comment')
    commentsError.value = ''
    let inserted = false
    try {
      const supabase = client()
      const { data, error } = await supabase.from('post_comments')
        .insert({ post_id: postId, author_id: userId!, content: content.trim() })
        .select('id, author_id, content, created_at, author:profiles!post_comments_author_id_fkey(full_name)').single()
      if (error || !data) throw error || new Error('comment')
      if (!current(userId, version)) return false
      inserted = true
      if (selectedId.value === postId) {
        // Invalidate a pre-insert comments response that could hide this comment.
        commentsVersion++
        commentsLoading.value = false
        comments.value = [data as unknown as FeedComment, ...comments.value.filter(item => item.id !== data.id)].slice(0, 50)
      }
      // Read the aggregate, including other members' concurrent comments.
      const refreshed = await supabase.from('posts').select(postSelection).eq('id', postId).maybeSingle()
      if (!current(userId, version)) return false
      if (refreshed.error || !refreshed.data) errorMessage.value = 'Comentário enviado. Não foi possível atualizar a contagem; atualize as conversas para conferir.'
      else posts.value = posts.value.map(post => post.id === postId ? refreshed.data as unknown as FeedPost : post)
      return true
    } catch {
      if (inserted && current(userId, version)) {
        errorMessage.value = 'Comentário enviado. Não foi possível atualizar a contagem; atualize as conversas para conferir.'
        return true
      }
      if (current(userId, version) && selectedId.value === postId) commentsError.value = 'Não foi possível enviar. Seu comentário foi mantido para você tentar novamente.'
      return false
    } finally {
      if (version === sessionVersion) busy.value = ''
    }
  }
  watch(() => auth.profile?.id, (userId) => {
    sessionVersion++
    loadVersion++
    commentsVersion++
    posts.value = []
    likedIds.value = []
    comments.value = []
    selectedId.value = ''
    commentsError.value = ''
    errorMessage.value = ''
    busy.value = ''
    loading.value = false
    commentsLoading.value = false
    hasMore.value = false
    nextOffset = 0
    if (userId) void load()
  }, { flush: 'sync' })
  return { posts, likedIds, comments, loading, commentsLoading, hasMore, busy, errorMessage, commentsError, selectedId, load, publish, toggleLike, loadComments, comment }
}
