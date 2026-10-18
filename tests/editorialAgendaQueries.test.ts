import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive, ref, watch } from 'vue'
import { usePublishedEditorial } from '../app/composables/usePublishedEditorial'
import { useChurchAgenda } from '../app/composables/useChurchAgenda'

function queryMock(result: { data: unknown, error: unknown }) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  for (const key of ['select', 'eq', 'is', 'gte', 'lt', 'or', 'not', 'order', 'limit', 'maybeSingle']) chain[key] = vi.fn(() => chain)
  chain.then = vi.fn((resolve: (value: typeof result) => void) => Promise.resolve(result).then(resolve))
  vi.stubGlobal('ref', ref)
  vi.stubGlobal('useNuxtApp', () => ({ $supabase: { from: vi.fn(() => chain) } }))
  return chain
}

let account: { profile: { id: string } | null }
beforeEach(() => {
  account = reactive({ profile: { id: 'account-a' } })
  vi.stubGlobal('watch', watch)
  vi.stubGlobal('useAuthStore', () => account)
})
afterEach(() => vi.unstubAllGlobals())

describe('consultas editoriais', () => {
  it('consulta apenas conteúdo publicado e com prazo de publicação já alcançado', async () => {
    const query = queryMock({ data: [{ slug: 'aviso-real' }], error: null })
    const editorial = usePublishedEditorial()
    expect(await editorial.list('news')).toEqual([{ slug: 'aviso-real' }])
    expect(query.eq).toHaveBeenCalledWith('status', 'published')
    expect(query.eq).toHaveBeenCalledWith('content_type', 'news')
    expect(query.or).toHaveBeenCalledWith(expect.stringMatching(/^publish_at.is.null,publish_at.lte./))
    expect(editorial.errorMessage.value).toBe('')
    expect(editorial.loading.value).toBe(false)
  })
  it('distingue falha de consulta e ausência real de publicações', async () => {
    queryMock({ data: null, error: { message: 'network error' } })
    const editorial = usePublishedEditorial()
    expect(await editorial.latest('word_of_day')).toBeNull()
    expect(editorial.errorMessage.value).toContain('Não foi possível')
    queryMock({ data: null, error: null })
    expect(await editorial.latest('word_of_day')).toBeNull()
    expect(editorial.errorMessage.value).toBe('')
  })
  it('exibe falha quando o serviço não está configurado', async () => {
    vi.stubGlobal('ref', ref)
    vi.stubGlobal('useNuxtApp', () => ({ $supabase: null }))
    const editorial = usePublishedEditorial()
    expect(await editorial.bySlug('news', 'qualquer')).toBeNull()
    expect(editorial.errorMessage.value).toContain('Não foi possível')
  })
})

describe('consulta central de agenda', () => {
  it.each(['B', 'B e de volta a A'])('não restaura eventos privados da sessão A após troca para %s', async (transition) => {
    const oldQuery = queryMock({ data: [], error: null })
    let finishOld!: (value: { data: unknown, error: unknown }) => void
    const pendingResult = new Promise<{ data: unknown, error: unknown }>((resolve) => {
      finishOld = resolve
    })
    oldQuery.then = vi.fn(resolve => pendingResult.then(resolve))
    const agenda = useChurchAgenda()
    const oldLoad = agenda.load()
    queryMock({ data: [], error: null })
    account.profile = { id: 'account-b' }
    if (transition !== 'B') account.profile = { id: 'account-a' }
    const newQuery = queryMock({ data: [], error: null })
    let finishNew!: (value: { data: unknown, error: unknown }) => void
    const newResult = new Promise<{ data: unknown, error: unknown }>((resolve) => {
      finishNew = resolve
    })
    newQuery.then = vi.fn(resolve => newResult.then(resolve))
    const newLoad = agenda.load()
    finishOld({ data: [{ id: 'private-from-old-session' }], error: null })
    await oldLoad
    expect(agenda.events.value).toEqual([])
    expect(agenda.loading.value).toBe(true)
    finishNew({ data: [{ id: 'current-event' }], error: null })
    await newLoad
    expect(agenda.events.value.map(event => event.id)).toEqual(['current-event'])
  })

  it('limpa imediatamente eventos privados ao sair e ignora falha pendente', async () => {
    queryMock({ data: [{ id: 'private-event' }], error: null })
    const agenda = useChurchAgenda()
    await agenda.load()
    const oldQuery = queryMock({ data: [], error: null })
    let finish!: (value: { data: unknown, error: unknown }) => void
    const result = new Promise<{ data: unknown, error: unknown }>((resolve) => {
      finish = resolve
    })
    oldQuery.then = vi.fn(resolve => result.then(resolve))
    const pending = agenda.load()
    account.profile = null
    expect(agenda.events.value).toEqual([])
    finish({ data: null, error: new Error('old failure') })
    await pending
    expect(agenda.errorMessage.value).toBe('')
    expect(agenda.loading.value).toBe(false)
  })
  it('restringe a superfície pública aos cultos explicitamente públicos, sem selecionar responsáveis', async () => {
    const query = queryMock({ data: [], error: null })
    const agenda = useChurchAgenda(true)
    await agenda.load(new Date('2026-10-18T12:00:00Z'))
    expect(query.eq).toHaveBeenCalledWith('public_visibility', true)
    expect(query.eq).toHaveBeenCalledWith('kind', 'service')
    expect(query.is).toHaveBeenCalledWith('cancelled_at', null)
    expect(query.is).toHaveBeenCalledWith('community_id', null)
    expect(query.is).toHaveBeenCalledWith('ministry_id', null)
    expect(query.select?.mock.calls[0]?.[0]).not.toContain('responsible_id')
    expect(agenda.errorMessage.value).toBe('')
  })
  it('preserva a agenda já conhecida quando a atualização falha', async () => {
    queryMock({ data: [{ id: 'evento-real' }], error: null })
    const agenda = useChurchAgenda()
    await agenda.load()
    queryMock({ data: null, error: new Error('offline') })
    await agenda.load()
    expect(agenda.events.value).toEqual([{ id: 'evento-real' }])
    expect(agenda.errorMessage.value).toContain('Não foi possível atualizar')
    expect(agenda.loading.value).toBe(false)
  })
})
