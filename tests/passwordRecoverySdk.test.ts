import { describe, expect, it, vi } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { PasswordRecoveryGate } from '../app/utils/passwordRecovery'
import type { BrowserStorage } from '../app/utils/authSessionStorage'

class MemoryStorage implements BrowserStorage {
  readonly values = new Map<string, string>()
  getItem(key: string) { return this.values.get(key) ?? null }
  setItem(key: string, value: string) { this.values.set(key, value) }
  removeItem(key: string) { this.values.delete(key) }
}

describe('installed Supabase PKCE recovery contract', () => {
  it('returns the recovery flow marker from a code exchange using a fully local fake transport', async () => {
    const storage = new MemoryStorage()
    const fakeFetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
      if (url.pathname.endsWith('/recover')) return new Response('{}', { status: 200 })
      if (url.pathname.endsWith('/token')) {
        return new Response(JSON.stringify({
          access_token: 'fixture-access-token', refresh_token: 'fixture-refresh-token', token_type: 'bearer', expires_in: 3600,
          user: { id: 'fixture-member', email: 'fixture@example.test' }
        }), { status: 200 })
      }
      throw new Error(`Unexpected fake request: ${url.pathname}`)
    })
    const client = createClient('https://fixture.supabase.co', 'fixture-publishable-key', {
      auth: { flowType: 'pkce', detectSessionInUrl: false, persistSession: true, autoRefreshToken: false, storage },
      global: { fetch: fakeFetch }
    })
    const gate = new PasswordRecoveryGate(new MemoryStorage(), new MemoryStorage())
    gate.begin('fixture-nonce')
    const recovery = await client.auth.resetPasswordForEmail('fixture@example.test')
    expect(recovery.error).toBeNull()
    const exchange = await client.auth.exchangeCodeForSession('fixture-code')
    expect(exchange.error).toBeNull()
    const redirectType = (exchange.data as typeof exchange.data & { redirectType?: unknown }).redirectType
    expect(redirectType).toBe('PASSWORD_RECOVERY')
    expect(gate.authorize(exchange.data.user?.id || '', 'fixture-nonce', redirectType)).toBe(true)
    expect(fakeFetch).toHaveBeenCalledTimes(2)
    await client.auth.stopAutoRefresh()
  })
})
