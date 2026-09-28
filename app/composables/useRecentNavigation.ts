import { pushRecentRoute } from '~/utils/navigation'

const STORAGE_KEY = 'ceda:menu-recentes'

function readStored(): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : []
  } catch {
    return []
  }
}

/** Páginas abertas recentemente, guardadas só neste aparelho. */
export function useRecentNavigation() {
  const recent = useState<string[]>('recent-navigation', () => [])
  const loaded = useState('recent-navigation-loaded', () => false)

  function ensureLoaded() {
    if (loaded.value || import.meta.server) return
    recent.value = readStored()
    loaded.value = true
  }

  function remember(to: string) {
    ensureLoaded()
    recent.value = pushRecentRoute(recent.value, to)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(recent.value))
    } catch {
      // Armazenamento indisponível (aba privada): a lista vale só nesta sessão.
    }
  }

  return { recent, ensureLoaded, remember }
}
