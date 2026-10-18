import type { BrowserStorage } from './authSessionStorage'

const PENDING_KEY = 'ceda.auth.password-recovery.pending'
const VERIFIED_KEY = 'ceda.auth.password-recovery.verified'
const VALIDITY_MS = 60 * 60 * 1000

/** Non-secret flow markers. The PKCE verifier and all credentials remain with the Supabase SDK. */
export class PasswordRecoveryGate {
  constructor(
    private readonly sharedStorage: BrowserStorage,
    private readonly tabStorage: BrowserStorage,
    private readonly now: () => number = Date.now
  ) {}

  private read(storage: BrowserStorage, key: string): Record<string, unknown> | null {
    try {
      const value = JSON.parse(storage.getItem(key) || 'null')
      return value && typeof value === 'object' && Number(value.expiresAt) > this.now() ? value : null
    } catch { return null }
  }

  begin(nonce: string) {
    this.sharedStorage.setItem(PENDING_KEY, JSON.stringify({ nonce, expiresAt: this.now() + VALIDITY_MS }))
    this.tabStorage.removeItem(VERIFIED_KEY)
  }

  hasPending(nonce: unknown): boolean {
    return typeof nonce === 'string' && Boolean(nonce) && this.read(this.sharedStorage, PENDING_KEY)?.nonce === nonce
  }

  cancel(nonce: string) {
    if (this.hasPending(nonce)) this.sharedStorage.removeItem(PENDING_KEY)
  }

  authorize(userId: string, nonce: unknown, redirectType: unknown): boolean {
    // Supabase's PKCE exchange returns the flow that created the verifier.
    // A later signup/OAuth exchange must never unlock the recovery form.
    if (redirectType !== 'PASSWORD_RECOVERY' || !userId || !this.hasPending(nonce)) return false
    this.sharedStorage.removeItem(PENDING_KEY)
    this.tabStorage.setItem(VERIFIED_KEY, JSON.stringify({ userId, expiresAt: this.now() + VALIDITY_MS }))
    return true
  }

  isAuthorized(userId: string): boolean {
    return Boolean(userId) && this.read(this.tabStorage, VERIFIED_KEY)?.userId === userId
  }

  clear() {
    this.sharedStorage.removeItem(PENDING_KEY)
    this.tabStorage.removeItem(VERIFIED_KEY)
  }
}
