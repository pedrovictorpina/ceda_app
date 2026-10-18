import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive, ref, watch } from 'vue'
import { useEventReminders } from '../app/composables/useEventReminders'
import type { AgendaEvent } from '../app/utils/churchAgenda'

const event: AgendaEvent = {
  id: 'event-real', title: 'Encontro', kind: 'event', starts_at: '2026-10-20T19:00:00-03:00', ends_at: null,
  location: null, description: null, cancelled_at: null, public_visibility: false
}

type QueryResult = { data: unknown, error: unknown }
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}
let account: { profile: { id: string } | null }

function clientMock(read: QueryResult | Promise<QueryResult>, mutationError: unknown = null) {
  const result = { error: mutationError }
  const select = vi.fn(() => ({ eq: vi.fn(async () => read) }))
  const upsert = vi.fn(async () => result)
  const eqUser = vi.fn(async () => result)
  const eqEvent = vi.fn(() => ({ eq: eqUser }))
  const remove = vi.fn(() => ({ eq: eqEvent }))
  vi.stubGlobal('useNuxtApp', () => ({ $supabase: { from: vi.fn(() => ({ select, upsert, delete: remove })) } }))
  return { upsert, remove, eqEvent, eqUser }
}
beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-18T12:00:00Z'))
  vi.stubGlobal('ref', ref)
  vi.stubGlobal('watch', watch)
  account = reactive({ profile: { id: 'my-profile' } })
  vi.stubGlobal('useAuthStore', () => account)
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('preferências persistentes de aviso', () => {
  it.each(['B', 'B e de volta a A'])('ignora carga adiada da sessão A após trocar para %s', async (transition) => {
    const old = deferred<QueryResult>()
    clientMock(old.promise)
    const reminders = useEventReminders()
    const oldLoad = reminders.load()
    clientMock({ data: [], error: null })
    account.profile = { id: 'account-b' }
    await reminders.load()
    if (transition !== 'B') account.profile = { id: 'my-profile' }
    const fresh = deferred<QueryResult>()
    clientMock(fresh.promise)
    const freshLoad = reminders.load()
    old.resolve({ data: [{ event_id: 'old-private-event', lead: 'day', cancelled_at: null }], error: null })
    await oldLoad
    expect(reminders.reminders.value).toEqual([])
    expect(reminders.loading.value).toBe(true)
    expect(reminders.ready.value).toBe(false)
    fresh.resolve({ data: [{ event_id: 'current-event', lead: 'hour', cancelled_at: null }], error: null })
    await freshLoad
    expect(reminders.reminders.value.map(item => item.event_id)).toEqual(['current-event'])
    expect(reminders.loading.value).toBe(false)
  })

  it.each(['B', 'B e de volta a A'])('não libera trava nem restaura preferência antiga após mutação adiada de A e troca para %s', async (transition) => {
    const old = deferred<{ error: unknown }>()
    const firstClient = clientMock({ data: [], error: null })
    firstClient.upsert.mockImplementationOnce(() => old.promise)
    const reminders = useEventReminders()
    await reminders.load()
    const oldToggle = reminders.toggle(event, 'day')
    const fresh = deferred<{ error: unknown }>()
    const nextClient = clientMock({ data: [], error: null })
    nextClient.upsert.mockImplementationOnce(() => fresh.promise)
    account.profile = { id: 'account-b' }
    if (transition !== 'B') account.profile = { id: 'my-profile' }
    await reminders.load()
    const nextEvent = { ...event, id: 'current-event' }
    const freshToggle = reminders.toggle(nextEvent, 'hour')
    old.resolve({ error: null })
    await oldToggle
    expect(reminders.hasReminder(event.id)).toBe(false)
    expect(reminders.savingId.value).toBe('current-event')
    expect(reminders.errorMessage.value).toBe('')
    fresh.resolve({ error: null })
    await freshToggle
    expect(reminders.hasReminder('current-event')).toBe(true)
    expect(reminders.savingId.value).toBe('')
  })

  it('limpa preferências imediatamente ao sair e ignora falha da carga antiga', async () => {
    const old = deferred<QueryResult>()
    clientMock(old.promise)
    const reminders = useEventReminders()
    reminders.reminders.value = [{ event_id: 'private-event', lead: 'day', scheduled_for: event.starts_at, cancelled_at: null }]
    const pending = reminders.load()
    account.profile = null
    expect(reminders.reminders.value).toEqual([])
    expect(reminders.ready.value).toBe(false)
    old.resolve({ data: null, error: new Error('old failure') })
    await pending
    expect(reminders.errorMessage.value).toBe('')
    expect(reminders.loading.value).toBe(false)
  })
  it('salva na conta e só apresenta sucesso após a resposta do serviço', async () => {
    const client = clientMock({ data: [], error: null })
    const reminders = useEventReminders()
    await reminders.load()
    await reminders.toggle(event, 'day')
    expect(client.upsert).toHaveBeenCalledWith({ event_id: 'event-real', user_id: 'my-profile', lead: 'day', scheduled_for: '2026-10-19T22:00:00.000Z', cancelled_at: null }, { onConflict: 'event_id,user_id,lead' })
    expect(reminders.hasReminder(event.id)).toBe(true)
    expect(reminders.errorMessage.value).toBe('')
  })
  it('não altera a interface para salva se o serviço rejeita a gravação', async () => {
    clientMock({ data: [], error: null }, { message: 'request failed' })
    const reminders = useEventReminders()
    await reminders.load()
    await reminders.toggle(event, 'day')
    expect(reminders.hasReminder(event.id)).toBe(false)
    expect(reminders.errorMessage.value).toContain('não foi alterada')
  })
  it('reencontra as preferências ao carregar novamente a página', async () => {
    clientMock({ data: [{ event_id: event.id, lead: 'day', scheduled_for: '2026-10-19T22:00:00Z', cancelled_at: null }], error: null })
    const reminders = useEventReminders()
    await reminders.load()
    expect(reminders.hasReminder(event.id)).toBe(true)
  })
  it('remove somente preferências do evento e da própria conta', async () => {
    const client = clientMock({ data: [{ event_id: event.id, lead: 'day', cancelled_at: null }], error: null })
    const reminders = useEventReminders()
    await reminders.load()
    await reminders.toggle(event, 'day')
    expect(client.eqEvent).toHaveBeenCalledWith('event_id', event.id)
    expect(client.eqUser).toHaveBeenCalledWith('user_id', 'my-profile')
    expect(reminders.hasReminder(event.id)).toBe(false)
  })
  it('preserva a preferência existente se a remoção falhar', async () => {
    clientMock({ data: [{ event_id: event.id, lead: 'day', cancelled_at: null }], error: null }, new Error('offline'))
    const reminders = useEventReminders()
    await reminders.load()
    await reminders.toggle(event, 'day')
    expect(reminders.hasReminder(event.id)).toBe(true)
  })
  it('impede alterações quando a carga inicial falha e permite recuperar por nova consulta', async () => {
    const client = clientMock({ data: null, error: new Error('offline') })
    const reminders = useEventReminders()
    await reminders.load()
    await reminders.toggle(event, 'day')
    expect(reminders.ready.value).toBe(false)
    expect(client.upsert).not.toHaveBeenCalled()
    clientMock({ data: [], error: null })
    await reminders.load()
    expect(reminders.ready.value).toBe(true)
    expect(reminders.errorMessage.value).toBe('')
  })
  it('oferece correção para intervalo passado e permite escolher outro sem recarregar', async () => {
    const client = clientMock({ data: [], error: null })
    const reminders = useEventReminders()
    await reminders.load()
    await reminders.toggle(event, 'week')
    expect(reminders.errorMessage.value).toContain('já passou')
    expect(client.upsert).not.toHaveBeenCalled()
    await reminders.toggle(event, 'hour')
    expect(reminders.errorMessage.value).toBe('')
    expect(reminders.hasReminder(event.id)).toBe(true)
  })
})
