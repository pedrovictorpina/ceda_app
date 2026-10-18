import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, reactive, ref, watch } from 'vue'
import { usePrayerRequests, type PrayerItem } from '../app/composables/usePrayerRequests'
import { useInternalNotifications, type InternalNotification } from '../app/composables/useInternalNotifications'
import { useProfileDetails } from '../app/composables/useProfileDetails'

interface Result { data: unknown, error: unknown }
function deferred() {
  let resolve!: (result: Result) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<Result>((done, fail) => {
    resolve = done
    reject = fail
  })
  return { promise, resolve, reject }
}
function query(promise: Promise<Result>) {
  const chain: Record<string, unknown> = {}
  for (const method of ['select', 'insert', 'update', 'eq', 'neq', 'order', 'range', 'single', 'maybeSingle']) chain[method] = vi.fn(() => chain)
  chain.then = (done: (value: Result) => unknown, fail: (error: unknown) => unknown) => promise.then(done, fail)
  return chain
}
function client(...responses: Array<Promise<Result> | Result>) {
  const chains = responses.map(response => query(Promise.resolve(response)))
  let index = 0
  const from = vi.fn(() => chains[index++])
  vi.stubGlobal('useNuxtApp', () => ({ $supabase: { from } }))
  return { from, chains }
}
const prayerRow = { id: 'prayer-1', title: 'Pedido privado', details: 'Texto sensível', visibility: 'private', status: 'active', created_at: '2026-10-18T12:00:00Z' }
const notification: InternalNotification = { id: 'notice-1', title: 'Aviso', body: 'Mensagem', deep_link: '/oracao', read_at: null, created_at: '2026-10-18T12:00:00Z', source_cell_id: null }
const profileRow = { full_name: 'Pessoa', email: 'pessoa@example.test', phone: '11999999999', sex: '', birth_date: '', notifications_enabled: false, birthday_greetings_opt_in: false, avatar_path: null }
let auth: { profile: { id: string, name: string, email: string } | null }

beforeEach(() => {
  auth = reactive({ profile: { id: 'member-1', name: 'Pessoa', email: 'pessoa@example.test' } })
  vi.stubGlobal('useAuthStore', () => auth)
  vi.stubGlobal('ref', ref)
  vi.stubGlobal('reactive', reactive)
  vi.stubGlobal('computed', computed)
  vi.stubGlobal('watch', watch)
  vi.stubGlobal('onBeforeUnmount', vi.fn())
})
afterEach(() => vi.unstubAllGlobals())

describe('pedidos de oração confirmados e privados', () => {
  it('não cria pedidos locais sem serviço e libera o envio após rejeição de rede', async () => {
    vi.stubGlobal('useNuxtApp', () => ({ $supabase: null }))
    const prayers = usePrayerRequests()
    const draft = { title: 'Pedido privado', details: 'Texto sensível', visibility: 'private' as const }
    expect(await prayers.create(draft)).toBeNull()
    expect(prayers.requests.value).toEqual([])
    const pending = deferred()
    const service = client(pending.promise)
    const save = prayers.create(draft)
    expect(prayers.saving.value).toBe(true)
    expect(await prayers.create(draft)).toBeNull()
    expect(service.from).toHaveBeenCalledTimes(1)
    pending.reject(new TypeError('offline'))
    await save
    expect(prayers.saving.value).toBe(false)
    expect(prayers.actionError.value).toContain('texto foi mantido')
    expect(prayers.requests.value).toEqual([])
    expect(draft.details).toBe('Texto sensível')
  })

  it('uma consulta antiga não apaga o pedido confirmado durante a espera', async () => {
    const load = deferred()
    client(load.promise, { data: prayerRow, error: null })
    const prayers = usePrayerRequests()
    const loading = prayers.load()
    await prayers.create({ title: 'Pedido privado', details: 'Texto sensível', visibility: 'private' })
    load.resolve({ data: [], error: null })
    await loading
    expect(prayers.requests.value).toHaveLength(1)
    expect(prayers.requests.value[0]?.id).toBe('prayer-1')
    expect(prayers.loading.value).toBe(false)
  })

  it('não confirma resposta quando nenhuma linha foi alterada e mantém registros conhecidos em falha de consulta', async () => {
    client({ data: [prayerRow], error: null }, { data: null, error: null }, { data: null, error: new Error('offline') })
    const prayers = usePrayerRequests()
    await prayers.load()
    expect(await prayers.markAnswered(prayers.requests.value[0] as PrayerItem)).toBe(false)
    expect(prayers.requests.value[0]?.status).toBe('active')
    await prayers.load()
    expect(prayers.requests.value).toHaveLength(1)
    expect(prayers.loadError.value).toBeTruthy()
  })

  it('limpa pedidos privados ao mudar de conta e ignora a consulta da conta anterior', async () => {
    const pending = deferred()
    client({ data: [prayerRow], error: null }, pending.promise)
    const prayers = usePrayerRequests()
    await prayers.load()
    const loading = prayers.load()
    auth.profile = { id: 'member-2', name: 'Outra pessoa', email: 'outra@example.test' }
    expect(prayers.requests.value).toEqual([])
    pending.resolve({ data: [prayerRow], error: null })
    await loading
    expect(prayers.requests.value).toEqual([])
  })
})

describe('avisos e concorrência', () => {
  it('uma atualização iniciada antes não volta a mostrar como não lido um aviso confirmado', async () => {
    const pending = deferred()
    client({ data: [notification], error: null }, pending.promise, { data: { id: notification.id }, error: null })
    const notices = useInternalNotifications()
    await notices.load()
    const loading = notices.load()
    await notices.markRead(notices.notifications.value[0] as InternalNotification)
    pending.resolve({ data: [notification], error: null })
    await loading
    expect(notices.notifications.value[0]?.read_at).toBeTruthy()
  })

  it('bloqueia paginação concorrente e permite tentar novamente sem perder avisos em falha', async () => {
    const firstPage = Array.from({ length: 50 }, (_, index) => ({ ...notification, id: `notice-${index}` }))
    const pending = deferred()
    const service = client({ data: firstPage, error: null }, pending.promise)
    const notices = useInternalNotifications()
    await notices.load()
    const loading = notices.load(true)
    await notices.load(true)
    expect(service.from).toHaveBeenCalledTimes(2)
    pending.reject(new TypeError('offline'))
    await loading
    expect(notices.loading.value).toBe(false)
    expect(notices.notifications.value).toHaveLength(50)
    expect(notices.errorMessage.value).toContain('mantidos')
  })

  it('não confirma leitura sem serviço e limpa os avisos ao sair da conta', async () => {
    client({ data: [notification], error: null })
    const notices = useInternalNotifications()
    await notices.load()
    vi.stubGlobal('useNuxtApp', () => ({ $supabase: null }))
    await notices.markRead(notices.notifications.value[0] as InternalNotification)
    expect(notices.notifications.value[0]?.read_at).toBeNull()
    expect(notices.markingId.value).toBe('')
    auth.profile = null
    expect(notices.notifications.value).toEqual([])
  })
})

describe('perfil sem perda de preferências ou rascunho', () => {
  it('falha de leitura não vira ausência de consentimento nem permite salvar defaults', async () => {
    const service = client({ data: null, error: new Error('offline') })
    const profile = useProfileDetails()
    await profile.load()
    expect(profile.ready.value).toBe(false)
    expect(await profile.save()).toBe(false)
    expect(service.from).toHaveBeenCalledTimes(1)
    expect(profile.errorMessage.value).toBeTruthy()
  })

  it('usa compatibilidade sem a preferência apenas quando a coluna realmente está ausente', async () => {
    client({ data: null, error: { code: 'PGRST204' } }, { data: profileRow, error: null })
    const profile = useProfileDetails()
    await profile.load()
    expect(profile.ready.value).toBe(true)
    expect(profile.birthdayOptInAvailable.value).toBe(false)
    expect(profile.dirty.value).toBe(false)
  })

  it('mantém edição e libera tentativa em rejeição; não repete envio enquanto aguarda', async () => {
    const pending = deferred()
    const service = client({ data: profileRow, error: null }, pending.promise)
    const profile = useProfileDetails()
    await profile.load()
    profile.form.name = 'Nome editado'
    const saving = profile.save()
    expect(await profile.save()).toBe(false)
    expect(service.from).toHaveBeenCalledTimes(2)
    pending.reject(new TypeError('offline'))
    await saving
    expect(profile.form.name).toBe('Nome editado')
    expect(profile.dirty.value).toBe(true)
    expect(profile.saving.value).toBe(false)
    expect(profile.status.value).toContain('continuam nesta tela')
  })

  it('a confirmação de uma gravação não descarta edição posterior nem atualiza outra conta', async () => {
    const pending = deferred()
    client({ data: profileRow, error: null }, pending.promise)
    const profile = useProfileDetails()
    await profile.load()
    profile.form.name = 'Nome enviado'
    const saving = profile.save()
    profile.form.name = 'Edição posterior'
    pending.resolve({ data: { id: 'member-1' }, error: null })
    await saving
    expect(profile.form.name).toBe('Edição posterior')
    expect(auth.profile?.name).toBe('Nome enviado')
    expect(profile.dirty.value).toBe(true)
    auth.profile = { id: 'member-2', name: 'Outra pessoa', email: 'outra@example.test' }
    expect(profile.form.name).toBe('Outra pessoa')
    expect(profile.form.phone).toBe('')
    expect(profile.ready.value).toBe(false)
  })
})
