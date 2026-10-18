import { afterEach, describe, expect, it, vi } from 'vitest'
import { effectScope, reactive, ref, watch, type EffectScope } from 'vue'
import { useSavedMessages } from '../app/composables/useSavedMessages'
import { useCommunityFeed } from '../app/composables/useCommunityFeed'

type Result = { data: unknown, error: unknown }
function deferred() {
  let resolve!: (result: Result) => void
  let reject!: (reason: Error) => void
  const promise = new Promise<Result>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}
const scopes: EffectScope[] = []
function setup(queues: Record<string, Array<Result | Promise<Result>>>) {
  const auth = reactive<{ profile: { id: string } | null }>({ profile: { id: 'account-a' } })
  const queries: Array<{ table: string, calls: Array<[string, unknown[]]> }> = []
  const from = vi.fn((table: string) => {
    const result = queues[table]?.shift() ?? { data: [], error: null }
    const trace = { table, calls: [] as Array<[string, unknown[]]> }
    queries.push(trace)
    const chain: Record<string, unknown> = {}
    for (const key of ['select', 'eq', 'is', 'or', 'order', 'range', 'in', 'limit', 'single', 'maybeSingle', 'insert', 'delete']) {
      chain[key] = (...args: unknown[]) => {
        trace.calls.push([key, args])
        return chain
      }
    }
    chain.then = (resolve: (result: Result) => unknown, reject: (error: Error) => unknown) => Promise.resolve(result).then(resolve, reject)
    return chain
  })
  vi.stubGlobal('ref', ref)
  vi.stubGlobal('watch', watch)
  vi.stubGlobal('useAuthStore', () => auth)
  vi.stubGlobal('useNuxtApp', () => ({ $supabase: { from } }))
  const scope = effectScope()
  scopes.push(scope)
  return { auth, queries, run: <T>(factory: () => T) => scope.run(factory)! }
}
const message = (id: string) => ({ id, slug: id, title: 'Palavra', content: 'Texto', message_date: '2026-10-18' })
const post = (id: string, comments = 0) => ({ id, author_id: 'account-a', title: id, description: 'Texto', created_at: '2026-10-18T10:00:00Z', author: null, likes: [{ count: 0 }], comments: [{ count: comments }] })
const comment = (id: string) => ({ id, author_id: 'account-a', content: id, created_at: '2026-10-18T10:00:00Z', author: null })
afterEach(() => {
  for (const scope of scopes.splice(0)) scope.stop()
  vi.unstubAllGlobals()
})

describe('saved messages account and network boundaries', () => {
  it('ignores an old session even if the same account signs in again before the response', async () => {
    const original = deferred()
    const { auth, run } = setup({ saved_messages: [original.promise, { data: [], error: null }, { data: [{ message: message('new-session') }], error: null }] })
    const saved = run(useSavedMessages)
    const loading = saved.load()
    auth.profile = { id: 'account-b' }
    auth.profile = { id: 'account-a' }
    await vi.waitFor(() => expect(saved.isSaved('new-session')).toBe(true))
    original.reject(new Error('old session network failure'))
    await loading
    expect(saved.errorMessage.value).toBe('')
    expect(saved.isSaved('new-session')).toBe(true)
  })
  it('ignores stale account responses, reloads new account, and filters publication timing explicitly', async () => {
    const old = deferred()
    const { auth, queries, run } = setup({ saved_messages: [old.promise, { data: [{ message: message('b') }], error: null }] })
    const saved = run(useSavedMessages)
    const oldLoad = saved.load()
    auth.profile = { id: 'account-b' }
    await vi.waitFor(() => expect(saved.messages.value.map(item => item.id)).toEqual(['b']))
    old.resolve({ data: [{ message: message('a') }], error: null })
    await oldLoad
    expect(saved.messages.value.map(item => item.id)).toEqual(['b'])
    expect(queries[1]?.calls).toContainEqual(['eq', ['user_id', 'account-b']])
    expect(queries[1]?.calls.some(([method, args]) => method === 'or' && String(args[0]).startsWith('publish_at.is.null,publish_at.lte.') && JSON.stringify(args[1]) === '{"referencedTable":"message"}')).toBe(true)
  })

  it('does not clear the next account list when a prior removal finishes late', async () => {
    const removal = deferred()
    const { auth, run } = setup({ saved_messages: [
      { data: [{ message: message('shared') }], error: null },
      removal.promise,
      { data: [{ message: message('shared') }], error: null }
    ] })
    const saved = run(useSavedMessages)
    await saved.load()
    const pending = saved.toggle('shared')
    auth.profile = { id: 'account-b' }
    await vi.waitFor(() => expect(saved.messages.value).toHaveLength(1))
    removal.resolve({ data: null, error: null })
    await pending
    expect(saved.isSaved('shared')).toBe(true)
  })

  it('preserves known bookmarks on refresh failure and rejects stale overlapping refreshes', async () => {
    const first = deferred()
    const { run } = setup({ saved_messages: [
      { data: [{ message: message('known') }], error: null },
      { data: null, error: new Error('offline') }, first.promise,
      { data: [{ message: message('latest') }], error: null }
    ] })
    const saved = run(useSavedMessages)
    await saved.load()
    await saved.load()
    expect(saved.isSaved('known')).toBe(true)
    expect(saved.errorMessage.value).toContain('Não foi possível')
    const old = saved.load()
    await saved.load()
    first.resolve({ data: [{ message: message('stale') }], error: null })
    await old
    expect(saved.messages.value.map(item => item.id)).toEqual(['latest'])
  })
})

describe('community feed races and confirmed interactions', () => {
  it('does not let an old account reaction clear a new account mutation lock', async () => {
    const oldLike = deferred()
    const newPost = deferred()
    const { auth, run } = setup({ post_likes: [oldLike.promise], posts: [{ data: [], error: null }, newPost.promise] })
    const feed = run(useCommunityFeed)
    const liking = feed.toggleLike(post('old'))
    auth.profile = { id: 'account-b' }
    await vi.waitFor(() => expect(feed.loading.value).toBe(false))
    const publishing = feed.publish('Título novo', 'Texto novo')
    oldLike.resolve({ data: null, error: null })
    await liking
    expect(feed.busy.value).toBe('publish')
    newPost.resolve({ data: post('new-account-post'), error: null })
    expect(await publishing).toBe(true)
    expect(feed.posts.value.map(item => item.id)).toEqual(['new-account-post'])
  })
  it('clears account state immediately and does not restore an old account response', async () => {
    const first = deferred()
    const { auth, run } = setup({ posts: [first.promise, { data: [post('b')], error: null }], post_likes: [{ data: [{ post_id: 'b' }], error: null }] })
    const feed = run(useCommunityFeed)
    feed.comments.value = [comment('private-draft-context')]
    const old = feed.load()
    auth.profile = { id: 'account-b' }
    expect(feed.comments.value).toEqual([])
    await vi.waitFor(() => expect(feed.posts.value.map(item => item.id)).toEqual(['b']))
    first.resolve({ data: [post('a')], error: null })
    await old
    expect(feed.posts.value.map(item => item.id)).toEqual(['b'])
    expect(feed.likedIds.value).toEqual(['b'])
    auth.profile = null
    expect(feed.posts.value).toEqual([])
    expect(feed.likedIds.value).toEqual([])
  })

  it('does not put a comment for A in B and uses the server aggregate instead of a local increment', async () => {
    const insertion = deferred()
    const { queries, run } = setup({ post_comments: [insertion.promise, { data: [comment('b-existing')], error: null }], posts: [{ data: post('a', 8), error: null }] })
    const feed = run(useCommunityFeed)
    feed.posts.value = [post('a', 1), post('b', 2)]
    feed.selectedId.value = 'a'
    const sending = feed.comment('Comentário de A')
    await feed.loadComments('b')
    insertion.resolve({ data: comment('a-new'), error: null })
    expect(await sending).toBe(true)
    expect(feed.comments.value.map(item => item.id)).toEqual(['b-existing'])
    expect(feed.posts.value.find(item => item.id === 'a')?.comments[0]?.count).toBe(8)
    expect(feed.posts.value.find(item => item.id === 'b')?.comments[0]?.count).toBe(2)
    expect(queries[0]?.calls).toContainEqual(['insert', [{ post_id: 'a', author_id: 'account-a', content: 'Comentário de A' }]])
  })

  it('keeps a successful comment confirmed when count refresh fails, preventing misleading retries', async () => {
    const { run } = setup({ post_comments: [{ data: comment('sent'), error: null }], posts: [Promise.reject(new Error('offline'))] })
    const feed = run(useCommunityFeed)
    feed.selectedId.value = 'a'
    expect(await feed.comment('Texto enviado')).toBe(true)
    expect(feed.comments.value.map(item => item.id)).toEqual(['sent'])
    expect(feed.commentsError.value).toBe('')
    expect(feed.errorMessage.value).toContain('Comentário enviado')
  })

  it('keeps newer comments when same-post refreshes finish in reverse order', async () => {
    const first = deferred()
    const { run } = setup({ post_comments: [first.promise, { data: [comment('new')], error: null }] })
    const feed = run(useCommunityFeed)
    const old = feed.loadComments('a')
    await feed.loadComments('a')
    first.resolve({ data: [comment('old')], error: null })
    await old
    expect(feed.comments.value.map(item => item.id)).toEqual(['new'])
  })

  it('opens older shared posts without skipping the next pagination row', async () => {
    const page = Array.from({ length: 20 }, (_, index) => post(`post-${index}`))
    const { queries, run } = setup({ posts: [
      { data: page, error: null }, { data: post('shared-older'), error: null },
      { data: [post('next')], error: null }
    ], post_likes: [{ data: [], error: null }, { data: [], error: null }] })
    const feed = run(useCommunityFeed)
    await feed.load(false, 'shared-older')
    expect(feed.posts.value).toHaveLength(21)
    expect(feed.hasMore.value).toBe(true)
    await feed.load(true)
    expect(queries.filter(query => query.table === 'posts')[2]?.calls).toContainEqual(['range', [20, 39]])
    expect(feed.posts.value.at(-1)?.id).toBe('next')
  })
})
