export const REMEMBER_ACCESS_KEY = 'ceda.auth.remember-access'

export interface BrowserStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export class RememberedSessionStorage {
  private remembered: boolean
  private readonly trackedKeys = new Set<string>()

  constructor(
    private readonly durableStorage: BrowserStorage,
    private readonly tabStorage: BrowserStorage
  ) {
    this.remembered = durableStorage.getItem(REMEMBER_ACCESS_KEY) === 'true'
  }

  get rememberAccess(): boolean {
    return this.remembered
  }

  setRememberAccess(value: boolean): void {
    if (value === this.remembered) return
    const source = this.remembered ? this.durableStorage : this.tabStorage
    const target = value ? this.durableStorage : this.tabStorage

    for (const key of this.trackedKeys) {
      const storedValue = source.getItem(key)
      if (storedValue !== null) target.setItem(key, storedValue)
      source.removeItem(key)
    }

    this.remembered = value
    if (value) this.durableStorage.setItem(REMEMBER_ACCESS_KEY, 'true')
    else this.durableStorage.removeItem(REMEMBER_ACCESS_KEY)
  }

  getItem(key: string): string | null {
    this.trackedKeys.add(key)
    return this.activeStorage.getItem(key)
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
