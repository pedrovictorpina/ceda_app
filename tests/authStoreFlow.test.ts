import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, defineStore, setActivePinia } from 'pinia'
import { ref } from 'vue'
import { PasswordRecoveryGate } from '../app/utils/passwordRecovery'
import type { BrowserStorage } from '../app/utils/authSessionStorage'

vi.stubGlobal('defineStore', defineStore)
const { useAuthStore } = await import('../app/stores/auth')
vi.unstubAllGlobals()

class MemoryStorage implements BrowserStorage {
  readonly values = new Map<string, string>()
  getItem(key: string) { return this.values.get(key) ?? null }
  setItem(key: string, value: string) { this.values.set(key, value) }
  removeItem(key: string) { this.values.delete(key) }
}

const user = (id: string) => ({ id, email: `${id}@example.test`, user_metadata: {} })
type UserResult = { data: { user: ReturnType<typeof user> | null }, error: Error | null }
function mockClient(userId = 'member-b', failingTable = '', storageReady?: () => Promise<void>) {
  const auth = {
    getUser: vi.fn(async (): Promise<UserResult> => ({ data: { user: user(userId) }, error: null })),
    signInWithPassword: vi.fn(async () => ({ error: null })),
    signOut: vi.fn(async () => ({ error: null as Error | null })),
    initialize: vi.fn(async () => ({ error: null })),
    exchangeCodeForSession: vi.fn(async () => ({ data: { user: user(userId), redirectType: 'PASSWORD_RECOVERY' as string | null }, error: null })),
    updateUser: vi.fn(async () => ({ error: null }))
  }
  const insert = vi.fn(async () => ({ error: null }))
  const from = vi.fn((table: string) => {
    let id = userId
    const result = () => ({
      data: table === 'profiles' ? { id, full_name: `Pessoa ${id}`, email: `${id}@example.test` } : table === 'user_system_roles' ? [{ role: 'member' }] : null,
      count: 0, error: failingTable === table ? new Error('connection failed') : null
    })
    const query = {
      select: vi.fn(() => query),
      eq: vi.fn((_column: string, value: string) => {
        if (_column === 'id') id = value
        return query
      }),
      maybeSingle: vi.fn(async () => result()),
      then: (resolve: (value: ReturnType<typeof result>) => void) => Promise.resolve(result()).then(resolve),
      insert
    }
    return query
  })
  vi.stubGlobal('useNuxtApp', () => ({
    $supabase: { auth, from },
    $authStorage: { rememberAccess: false, setRememberAccess: vi.fn(), ...(storageReady ? { ready: storageReady } : {}) }
  }))
  return { auth, from, insert }
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.stubGlobal('ref', ref)
  vi.stubGlobal('localStorage', new MemoryStorage())
  vi.stubGlobal('sessionStorage', new MemoryStorage())
  vi.stubGlobal('window', { location: { href: 'https://fixture.test/redefinir-senha?code=fixture&recuperacao=nonce' }, history: { state: null, replaceState: vi.fn() } })
})
afterEach(() => vi.unstubAllGlobals())

describe('auth store identity and recovery', () => {
  it('keeps loading while native storage restores the saved session before checking its user', async () => {
    let restore!: () => void
    const ready = new Promise<void>((resolve) => {
      restore = resolve
    })
    const client = mockClient('member-b', '', () => ready)
    const store = useAuthStore()
    const checking = store.hydrate()
    expect(store.loading).toBe(true)
    expect(store.profile).toBeNull()
    expect(client.auth.getUser).not.toHaveBeenCalled()
    restore()
    await checking
    expect(store.loading).toBe(false)
    expect(store.profile?.id).toBe('member-b')
  })

  it('clears loading and stale profile instead of silently substituting member permissions on query failure', async () => {
    mockClient('member-b', 'user_system_roles')
    const store = useAuthStore()
    store.profile = { id: 'old-account', name: 'Old', email: 'old@example.test', roles: ['administrator'], isApprovedGuardian: false, isChildrenTeam: false }
    await expect(store.hydrate()).rejects.toThrow('connection failed')
    expect(store.loading).toBe(false)
    expect(store.profile).toBeNull()
  })

  it('does not reinterpret a failed role query as permission to create a member role', async () => {
    const client = mockClient('member-b', 'user_system_roles')
    await expect(useAuthStore().hydrate()).rejects.toThrow()
    expect(client.insert).not.toHaveBeenCalled()
  })

  it('shares an in-flight session check and keeps loading until the profile is ready', async () => {
    const client = mockClient()
    let finish!: (value: UserResult) => void
    client.auth.getUser.mockImplementationOnce(() => new Promise((resolve) => {
      finish = resolve
    }))
    const store = useAuthStore()
    const first = store.hydrate()
    const second = store.hydrate()
    expect(store.loading).toBe(true)
    expect(store.profile).toBeNull()
    expect(client.auth.getUser).toHaveBeenCalledTimes(1)
    finish({ data: { user: user('member-b') }, error: null })
    await Promise.all([first, second])
    expect(store.loading).toBe(false)
    expect(store.profile?.id).toBe('member-b')
  })

  it('does not overwrite a signed-in account when an older hydration finishes late', async () => {
    const client = mockClient()
    let finishFirst!: (value: UserResult) => void
    client.auth.getUser.mockImplementationOnce(() => new Promise((resolve) => {
      finishFirst = resolve
    }))
    const store = useAuthStore()
    const first = store.hydrate()
    await store.signIn('member-b@example.test', 'fixture-password')
    expect(store.profile?.id).toBe('member-b')
    finishFirst({ data: { user: user('old-account') }, error: null })
    await first
    expect(store.profile?.id).toBe('member-b')
    expect(client.auth.getUser).toHaveBeenCalledTimes(2)
  })

  it('does not finish sign-in without a verified profile', async () => {
    const client = mockClient()
    client.auth.getUser.mockResolvedValue({ data: { user: null }, error: null })
    await expect(useAuthStore().signIn('member-b@example.test', 'fixture-password')).rejects.toThrow()
    expect(useAuthStore().profile).toBeNull()
    expect(useAuthStore().loading).toBe(false)
  })

  it('does not restore an in-flight profile after successful sign-out', async () => {
    const client = mockClient()
    let finish!: (value: UserResult) => void
    client.auth.getUser.mockImplementationOnce(() => new Promise((resolve) => {
      finish = resolve
    }))
    const store = useAuthStore()
    const pending = store.hydrate()
    await store.signOut()
    finish({ data: { user: user('old-account') }, error: null })
    await pending
    expect(store.profile).toBeNull()
    expect(store.loading).toBe(false)
  })

  it('reports sign-out failure and keeps the current account instead of pretending access ended', async () => {
    const client = mockClient()
    const store = useAuthStore()
    await store.hydrate()
    client.auth.signOut.mockResolvedValue({ error: new Error('offline') })
    await expect(store.signOut()).rejects.toThrow('offline')
    expect(store.profile?.id).toBe('member-b')
  })

  it('refuses a signup exchange with a pending recovery nonce and clears the prior profile', async () => {
    const client = mockClient()
    const store = useAuthStore()
    await store.hydrate()
    new PasswordRecoveryGate(localStorage, sessionStorage).begin('nonce')
    client.auth.exchangeCodeForSession.mockResolvedValue({ data: { user: user('signup-user'), redirectType: null }, error: null })
    expect(await store.preparePasswordReset('signup-code', 'nonce')).toBe(false)
    expect(store.profile).toBeNull()
    expect(new PasswordRecoveryGate(localStorage, sessionStorage).isAuthorized('signup-user')).toBe(false)
  })

  it('requires a verified recovery for the current identity immediately before updating its password', async () => {
    const client = mockClient()
    const store = useAuthStore()
    new PasswordRecoveryGate(localStorage, sessionStorage).begin('nonce')
    expect(await store.preparePasswordReset('recovery-code', 'nonce')).toBe(true)
    client.auth.getUser.mockResolvedValue({ data: { user: user('different-account') }, error: null })
    await expect(store.updatePassword('NovaSenha123')).rejects.toThrow('Recovery required')
    expect(client.auth.updateUser).not.toHaveBeenCalled()
  })
})
