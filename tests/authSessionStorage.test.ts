import { describe, expect, it } from 'vitest'
import { REMEMBER_ACCESS_KEY, RememberedSessionStorage, type BrowserStorage } from '../app/utils/authSessionStorage'

class MemoryStorage implements BrowserStorage {
  readonly values = new Map<string, string>()
  getItem(key: string) { return this.values.get(key) ?? null }
  setItem(key: string, value: string) { this.values.set(key, value) }
  removeItem(key: string) { this.values.delete(key) }
}

describe('remembered Supabase session storage', () => {
  it('uses tab storage by default', () => {
    const durable = new MemoryStorage()
    const tab = new MemoryStorage()
    const storage = new RememberedSessionStorage(durable, tab)
    storage.setItem('sb-auth-token', 'session')
    expect(tab.getItem('sb-auth-token')).toBe('session')
    expect(durable.getItem('sb-auth-token')).toBeNull()
  })

  it('uses durable storage only after explicit opt-in', () => {
    const durable = new MemoryStorage()
    const tab = new MemoryStorage()
    const storage = new RememberedSessionStorage(durable, tab)
    storage.getItem('sb-auth-token')
    storage.setRememberAccess(true)
    storage.setItem('sb-auth-token', 'session')
    expect(durable.getItem(REMEMBER_ACCESS_KEY)).toBe('true')
    expect(durable.getItem('sb-auth-token')).toBe('session')
    expect(tab.getItem('sb-auth-token')).toBeNull()
  })

  it('moves a tracked session back to tab storage when disabled', () => {
    const durable = new MemoryStorage()
    durable.setItem(REMEMBER_ACCESS_KEY, 'true')
    durable.setItem('sb-auth-token', 'session')
    const tab = new MemoryStorage()
    const storage = new RememberedSessionStorage(durable, tab)
    storage.getItem('sb-auth-token')
    storage.setRememberAccess(false)
    expect(durable.getItem('sb-auth-token')).toBeNull()
    expect(tab.getItem('sb-auth-token')).toBe('session')
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
