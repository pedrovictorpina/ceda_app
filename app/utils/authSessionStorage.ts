export const REMEMBER_ACCESS_KEY = 'ceda.auth.remember-access'

export interface BrowserStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export interface NativeStorage {
  getItem(key: string): Promise<string | null>
  setItem(key: string, value: string): Promise<void>
  removeItem(key: string): Promise<void>
}

export class NativeRememberedSessionStorage {
  private remembered = true
  private readonly trackedKeys = new Set<string>()
  private readonly initialization: Promise<void>

  constructor(
    private readonly nativeStorage: NativeStorage,
    private readonly durableStorage: BrowserStorage,
    private readonly tabStorage: BrowserStorage
  ) {
    this.initialization = this.initialize()
  }

  private async initialize(): Promise<void> {
    const nativePreference = await this.nativeStorage.getItem(REMEMBER_ACCESS_KEY)
    this.remembered = (nativePreference ?? this.durableStorage.getItem(REMEMBER_ACCESS_KEY)) !== 'false'
    if (nativePreference === null) {
      await this.nativeStorage.setItem(REMEMBER_ACCESS_KEY, String(this.remembered))
    }
  }

  async ready(): Promise<void> {
    await this.initialization
  }

  get rememberAccess(): boolean {
    return this.remembered
  }

  async setRememberAccess(value: boolean): Promise<void> {
    await this.ready()
    if (value !== this.remembered) {
      for (const key of this.trackedKeys) {
        const session = this.remembered
          ? await this.nativeStorage.getItem(key)
          : this.tabStorage.getItem(key)
        if (value) {
          if (session !== null) await this.nativeStorage.setItem(key, session)
          this.tabStorage.removeItem(key)
        } else {
          if (session !== null) this.tabStorage.setItem(key, session)
          await this.nativeStorage.removeItem(key)
        }
      }
    }
    await this.nativeStorage.setItem(REMEMBER_ACCESS_KEY, String(value))
    this.durableStorage.setItem(REMEMBER_ACCESS_KEY, String(value))
    this.remembered = value
  }

  async getItem(key: string): Promise<string | null> {
    await this.ready()
    this.trackedKeys.add(key)
    if (!this.remembered) return this.tabStorage.getItem(key)

    const nativeSession = await this.nativeStorage.getItem(key)
    if (nativeSession !== null) return nativeSession

    // Existing APKs kept sessions in WebView storage. Migrate them once while
    // they are still available, then rely on the app's native preferences.
    const legacySession = this.durableStorage.getItem(key) ?? this.tabStorage.getItem(key)
    if (legacySession !== null) {
      await this.nativeStorage.setItem(key, legacySession)
      this.durableStorage.removeItem(key)
      this.tabStorage.removeItem(key)
    }
    return legacySession
  }

  async setItem(key: string, value: string): Promise<void> {
    await this.ready()
    this.trackedKeys.add(key)
    if (this.remembered) {
      await this.nativeStorage.setItem(key, value)
      this.durableStorage.removeItem(key)
      this.tabStorage.removeItem(key)
    } else {
      this.tabStorage.setItem(key, value)
      await this.nativeStorage.removeItem(key)
      this.durableStorage.removeItem(key)
    }
  }

  async removeItem(key: string): Promise<void> {
    await this.ready()
    this.trackedKeys.add(key)
    await this.nativeStorage.removeItem(key)
    this.durableStorage.removeItem(key)
    this.tabStorage.removeItem(key)
  }
}

export class RememberedSessionStorage {
  private remembered: boolean
  private readonly trackedKeys = new Set<string>()

  constructor(
    private readonly durableStorage: BrowserStorage,
    private readonly tabStorage: BrowserStorage
  ) {
    // Access remains active by default so a normal refresh, PWA reload, or a
    // newly deployed version never makes a member sign in again. Members can
    // still explicitly opt out and keep access only for the current tab.
    this.remembered = durableStorage.getItem(REMEMBER_ACCESS_KEY) !== 'false'
  }

  get rememberAccess(): boolean {
    return this.remembered
  }

  setRememberAccess(value: boolean): void {
    if (value === this.remembered) {
      this.durableStorage.setItem(REMEMBER_ACCESS_KEY, String(value))
      return
    }
    const source = this.remembered ? this.durableStorage : this.tabStorage
    const target = value ? this.durableStorage : this.tabStorage

    for (const key of this.trackedKeys) {
      const storedValue = source.getItem(key)
      if (storedValue !== null) target.setItem(key, storedValue)
      source.removeItem(key)
    }

    this.remembered = value
    this.durableStorage.setItem(REMEMBER_ACCESS_KEY, String(value))
  }

  getItem(key: string): string | null {
    this.trackedKeys.add(key)
    const value = this.activeStorage.getItem(key)
    if (value !== null || !this.remembered) return value

    // Upgrade sessions created before persistent access became the default.
    // This runs only for the active Supabase session key and never stores a
    // password (Supabase stores tokens, not the submitted password).
    const legacyValue = this.tabStorage.getItem(key)
    if (legacyValue !== null) {
      this.durableStorage.setItem(key, legacyValue)
      this.tabStorage.removeItem(key)
    }
    return legacyValue
  }

  setItem(key: string, value: string): void {
    this.trackedKeys.add(key)
    this.activeStorage.setItem(key, value)
    this.inactiveStorage.removeItem(key)
  }

  removeItem(key: string): void {
    this.trackedKeys.add(key)
    this.durableStorage.removeItem(key)
    this.tabStorage.removeItem(key)
  }

  private get activeStorage(): BrowserStorage {
    return this.remembered ? this.durableStorage : this.tabStorage
  }

  private get inactiveStorage(): BrowserStorage {
    return this.remembered ? this.tabStorage : this.durableStorage
  }
}
