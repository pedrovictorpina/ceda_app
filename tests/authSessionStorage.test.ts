import { describe, expect, it } from 'vitest'
import { NativeRememberedSessionStorage, REMEMBER_ACCESS_KEY, RememberedSessionStorage, type BrowserStorage } from '../app/utils/authSessionStorage'

class MemoryStorage implements BrowserStorage {
  readonly values = new Map<string, string>()
  getItem(key: string) { return this.values.get(key) ?? null }
  setItem(key: string, value: string) { this.values.set(key, value) }
  removeItem(key: string) { this.values.delete(key) }
}

function nativeAdapter(storage: MemoryStorage) {
  return {
    async getItem(key: string) { return storage.getItem(key) },
    async setItem(key: string, value: string) { storage.setItem(key, value) },
    async removeItem(key: string) { storage.removeItem(key) }
  }
}

describe('remembered Supabase session storage', () => {
  it('uses durable storage by default so refreshes keep the session', () => {
    const durable = new MemoryStorage()
    const tab = new MemoryStorage()
    const storage = new RememberedSessionStorage(durable, tab)
    storage.setItem('sb-auth-token', 'session')
    expect(durable.getItem('sb-auth-token')).toBe('session')
    expect(tab.getItem('sb-auth-token')).toBeNull()
  })

  it('uses tab storage when the member explicitly opts out', () => {
    const durable = new MemoryStorage()
    const tab = new MemoryStorage()
    const storage = new RememberedSessionStorage(durable, tab)
    storage.setRememberAccess(false)
    storage.setItem('sb-auth-token', 'session')
    expect(durable.getItem(REMEMBER_ACCESS_KEY)).toBe('false')
    expect(durable.getItem('sb-auth-token')).toBeNull()
    expect(tab.getItem('sb-auth-token')).toBe('session')
  })

  it('migrates a legacy tab-only session to durable storage', () => {
    const durable = new MemoryStorage()
    const tab = new MemoryStorage()
    tab.setItem('sb-auth-token', 'session')
    const storage = new RememberedSessionStorage(durable, tab)
    expect(storage.getItem('sb-auth-token')).toBe('session')
    expect(durable.getItem('sb-auth-token')).toBe('session')
    expect(tab.getItem('sb-auth-token')).toBeNull()
  })

  it('removes session data from both stores', () => {
    const durable = new MemoryStorage()
    const tab = new MemoryStorage()
    durable.setItem('sb-auth-token', 'old')
    tab.setItem('sb-auth-token', 'current')
    const storage = new RememberedSessionStorage(durable, tab)
    storage.removeItem('sb-auth-token')
    expect(durable.getItem('sb-auth-token')).toBeNull()
    expect(tab.getItem('sb-auth-token')).toBeNull()
  })
})

describe('native remembered Supabase session storage', () => {
  it('keeps a remembered session after the WebView storage is cleared and the app restarts', async () => {
    const native = new MemoryStorage()
    const first = new NativeRememberedSessionStorage(nativeAdapter(native), new MemoryStorage(), new MemoryStorage())
    await first.setItem('sb-auth-token', 'session')

    const reopened = new NativeRememberedSessionStorage(nativeAdapter(native), new MemoryStorage(), new MemoryStorage())
    expect(await reopened.getItem('sb-auth-token')).toBe('session')
    expect(reopened.rememberAccess).toBe(true)
  })

  it('migrates an existing WebView session to native storage', async () => {
    const native = new MemoryStorage()
    const browser = new MemoryStorage()
    browser.setItem('sb-auth-token', 'existing-session')
    const storage = new NativeRememberedSessionStorage(nativeAdapter(native), browser, new MemoryStorage())

    expect(await storage.getItem('sb-auth-token')).toBe('existing-session')
    expect(native.getItem('sb-auth-token')).toBe('existing-session')
    expect(browser.getItem('sb-auth-token')).toBeNull()
  })

  it('honors opt-out across restarts and removes remembered tokens on sign-out', async () => {
    const native = new MemoryStorage()
    const browser = new MemoryStorage()
    const tab = new MemoryStorage()
    const storage = new NativeRememberedSessionStorage(nativeAdapter(native), browser, tab)
    await storage.setItem('sb-auth-token', 'session')
    await storage.setRememberAccess(false)
    expect(native.getItem('sb-auth-token')).toBeNull()
    expect(tab.getItem('sb-auth-token')).toBe('session')

    const reopened = new NativeRememberedSessionStorage(nativeAdapter(native), new MemoryStorage(), new MemoryStorage())
    await reopened.ready()
    expect(reopened.rememberAccess).toBe(false)
    expect(await reopened.getItem('sb-auth-token')).toBeNull()

    await storage.setRememberAccess(true)
    await storage.removeItem('sb-auth-token')
    expect(native.getItem('sb-auth-token')).toBeNull()
    expect(tab.getItem('sb-auth-token')).toBeNull()
  })
})
