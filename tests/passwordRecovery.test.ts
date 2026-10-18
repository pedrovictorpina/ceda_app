import { describe, expect, it } from 'vitest'
import type { BrowserStorage } from '../app/utils/authSessionStorage'
import { PasswordRecoveryGate } from '../app/utils/passwordRecovery'

class MemoryStorage implements BrowserStorage {
  readonly values = new Map<string, string>()
  getItem(key: string) { return this.values.get(key) ?? null }
  setItem(key: string, value: string) { this.values.set(key, value) }
  removeItem(key: string) { this.values.delete(key) }
}

describe('password recovery authorization', () => {
  it('rejects a signup or OAuth PKCE exchange even if a recovery nonce is still pending', () => {
    const gate = new PasswordRecoveryGate(new MemoryStorage(), new MemoryStorage())
    gate.begin('recovery-nonce')
    expect(gate.authorize('signup-user', 'recovery-nonce', null)).toBe(false)
    expect(gate.authorize('oauth-user', 'recovery-nonce', 'SIGNED_IN')).toBe(false)
    expect(gate.isAuthorized('signup-user')).toBe(false)
    expect(gate.hasPending('recovery-nonce')).toBe(true)
    expect(gate.authorize('recovery-user', 'recovery-nonce', 'PASSWORD_RECOVERY')).toBe(true)
  })
  it('never treats a normal signed-in session as a verified recovery', () => {
    const gate = new PasswordRecoveryGate(new MemoryStorage(), new MemoryStorage())
    expect(gate.isAuthorized('member-1')).toBe(false)
    expect(gate.authorize('member-1', 'invented-nonce', 'PASSWORD_RECOVERY')).toBe(false)
    expect(gate.hasPending(undefined)).toBe(false)
  })

  it('requires the requested flow and binds a verified PKCE result to its user', () => {
    const gate = new PasswordRecoveryGate(new MemoryStorage(), new MemoryStorage())
    gate.begin('requested-nonce')
    expect(gate.authorize('member-1', 'different-nonce', 'PASSWORD_RECOVERY')).toBe(false)
    expect(gate.isAuthorized('member-1')).toBe(false)
    expect(gate.authorize('member-1', 'requested-nonce', 'PASSWORD_RECOVERY')).toBe(true)
    expect(gate.isAuthorized('member-1')).toBe(true)
    expect(gate.isAuthorized('member-2')).toBe(false)
    expect(gate.authorize('member-1', 'requested-nonce', 'PASSWORD_RECOVERY')).toBe(false)
  })

  it('lets a recovery email open in another tab, then allows reload only in the verified tab', () => {
    const shared = new MemoryStorage()
    const verifiedTab = new MemoryStorage()
    new PasswordRecoveryGate(shared, new MemoryStorage()).begin('nonce')
    expect(new PasswordRecoveryGate(shared, verifiedTab).authorize('member-1', 'nonce', 'PASSWORD_RECOVERY')).toBe(true)
    expect(new PasswordRecoveryGate(shared, verifiedTab).isAuthorized('member-1')).toBe(true)
    expect(new PasswordRecoveryGate(shared, new MemoryStorage()).isAuthorized('member-1')).toBe(false)
  })

  it('expires pending and verified flows and clears them after password change or sign-out', () => {
    let now = 0
    const gate = new PasswordRecoveryGate(new MemoryStorage(), new MemoryStorage(), () => now)
    gate.begin('expired')
    now = 60 * 60 * 1000 + 1
    expect(gate.hasPending('expired')).toBe(false)
    gate.begin('current')
    expect(gate.authorize('member-1', 'current', 'PASSWORD_RECOVERY')).toBe(true)
    now += 60 * 60 * 1000 + 1
    expect(gate.isAuthorized('member-1')).toBe(false)
    gate.begin('last')
    gate.authorize('member-1', 'last', 'PASSWORD_RECOVERY')
    gate.clear()
    expect(gate.isAuthorized('member-1')).toBe(false)
    expect(gate.hasPending('last')).toBe(false)
  })

  it('invalidates the prior request when a new link is requested and handles corrupted storage', () => {
    const shared = new MemoryStorage()
    const tab = new MemoryStorage()
    const gate = new PasswordRecoveryGate(shared, tab)
    gate.begin('first')
    gate.begin('second')
    gate.cancel('first')
    expect(gate.hasPending('first')).toBe(false)
    expect(gate.hasPending('second')).toBe(true)
    for (const key of shared.values.keys()) shared.setItem(key, '{broken')
    expect(gate.hasPending('second')).toBe(false)
  })
})
