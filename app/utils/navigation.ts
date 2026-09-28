import type { NavigationItem, NavigationSection, NavigationTab } from '~/types/domain'

export type BottomNavProfile = 'admin' | 'staff' | 'parent' | 'member'

/** Rotas fixas da barra inferior por perfil; a quinta posição é sempre o Menu. */
export const BOTTOM_NAV_ROUTES: Record<BottomNavProfile, readonly string[]> = {
  admin: ['/admin', '/admin/pessoas', '/admin/agenda', '/operacao'],
  staff: ['/inicio', '/operacao', '/eventos', '/loja'],
  parent: ['/inicio', '/sementinhas', '/eventos', '/loja'],
  member: ['/inicio', '/eventos', '/celulas', '/loja']
}

export const RECENT_NAVIGATION_LIMIT = 4

export interface BottomNavContext {
  isAdminView: boolean
  canOperateStore: boolean
  caresForChildren: boolean
}

export function bottomNavProfile(context: BottomNavContext): BottomNavProfile {
  if (context.isAdminView) return 'admin'
  if (context.canOperateStore) return 'staff'
  if (context.caresForChildren) return 'parent'
  return 'member'
}

/** Mantém a ordem da barra inferior definida em BOTTOM_NAV_ROUTES. */
export function pickBottomNavItems(items: readonly NavigationItem[], profile: BottomNavProfile) {
  return BOTTOM_NAV_ROUTES[profile].flatMap((to) => {
    const item = items.find(entry => entry.to === to)
    return item ? [item] : []
  })
}

function routeMatches(path: string, to: string) {
  return path === to || path.startsWith(`${to}/`)
}

/** Tamanho da rota que melhor casa com o caminho atual; -1 quando nenhuma casa. */
function matchLength(path: string, routes: readonly string[]) {
  return routes.reduce((best, to) => routeMatches(path, to) ? Math.max(best, to.length) : best, -1)
}

/** O item ativo é o que tem a rota mais específica para o caminho atual. */
export function findActiveItem<T extends Pick<NavigationItem, 'to' | 'matches'>>(items: readonly T[], path: string) {
  let active: T | undefined
  let bestLength = -1
  for (const item of items) {
    const length = matchLength(path, [item.to, ...(item.matches ?? [])])
    if (length > bestLength) {
      active = item
      bestLength = length
    }
  }
  return active
}

export function findSectionForPath(sections: readonly NavigationSection[], path: string) {
  return sections.find(section => section.tabs.some(tab => routeMatches(path, tab.to)))
}

export function findActiveTab(tabs: readonly NavigationTab[], path: string) {
  return findActiveItem(tabs, path)
}

function normalize(text: string) {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('pt-BR').trim()
}

export interface SearchableEntry {
  label: string
  icon: string
  to: string
  keywords?: string[]
  /** Seção de onde a página vem, exibida ao lado do resultado da busca. */
  context?: string
}

/** Junta itens do menu e abas das seções, sem repetir destinos. */
export function buildSearchIndex(items: readonly NavigationItem[], sections: readonly NavigationSection[]): SearchableEntry[] {
  const entries: SearchableEntry[] = [
    ...items.map(({ label, icon, to, keywords }) => ({ label, icon, to, keywords })),
    ...sections.flatMap(section => section.tabs.map(tab => ({ label: tab.label, icon: tab.icon, to: tab.to, keywords: [section.label], context: section.label })))
  ]
  return entries.filter((entry, index) => entries.findIndex(other => other.to === entry.to) === index)
}

export function searchNavigation(entries: readonly SearchableEntry[], term: string) {
  const query = normalize(term)
  if (!query) return []
  return entries.filter(entry => [entry.label, ...(entry.keywords ?? [])].some(text => normalize(text).includes(query)))
}

export function pushRecentRoute(recent: readonly string[], to: string, limit = RECENT_NAVIGATION_LIMIT) {
  return [to, ...recent.filter(route => route !== to)].slice(0, limit)
}
