import { describe, expect, it } from 'vitest'
import { REMEMBER_ACCESS_KEY, RememberedSessionStorage, type BrowserStorage } from '../app/utils/authSessionStorage'

class MemoryStorage implements BrowserStorage {
  readonly values = new Map<string, string>()
  getItem(key: string) { return this.values.get(key) ?? null }
  setItem(key: string, value: string) { this.values.set(key, value) }
  removeItem(key: string) { this.values.delete(key) }
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
