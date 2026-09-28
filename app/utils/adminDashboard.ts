import type { SessionProfile } from '~/types/domain'
import { canManageChurch, canOperateStore, canTeachChildren, hasRole } from './authorization'

/* Estado de cada seção ------------------------------------------------------ */

/** `unavailable`: a tabela/RPC ainda não existe no banco (migração pendente). */
export type SectionStatus = 'loading' | 'ready' | 'error' | 'unavailable' | 'hidden'

export interface SectionState<T> {
  status: SectionStatus
  data: T | null
  message: string
  /** Recarregando com dados anteriores ainda na tela (sem piscar esqueleto). */
  refreshing: boolean
}

export type TileTone = 'success' | 'error' | 'warning' | 'neutral'

/** Linha da tabela alternativa de cada gráfico. */
export interface ChartTableRow {
  key: string
  label: string
  value: string
  extra?: string
}

export interface DatabaseErrorShape {
  code?: string
  message?: string
}

export const UNAVAILABLE_MESSAGE = 'Disponível após a atualização do banco.'

// PGRST205/42P01: tabela inexistente; PGRST202/42883: função inexistente; PGRST204/42703: coluna inexistente.
const MISSING_SCHEMA_CODES = new Set(['PGRST205', 'PGRST202', 'PGRST204', '42P01', '42883', '42703'])

export function isMissingSchemaError(error: DatabaseErrorShape | null | undefined): boolean {
  if (!error) return false
  if (error.code && MISSING_SCHEMA_CODES.has(error.code)) return true
  return /schema cache|does not exist/i.test(error.message ?? '')
}

export function initialSection<T>(): SectionState<T> {
  return { status: 'loading', data: null, message: '', refreshing: false }
}

export function hiddenSection<T>(): SectionState<T> {
  return { status: 'hidden', data: null, message: '', refreshing: false }
}

/** Mantém os dados anteriores enquanto recarrega; sem dados, volta ao esqueleto. */
export function reloadingSection<T>(previous: SectionState<T>): SectionState<T> {
  return previous.data === null
    ? { ...initialSection<T>() }
    : { ...previous, refreshing: true }
}

export function readySection<T>(data: T): SectionState<T> {
  return { status: 'ready', data, message: '', refreshing: false }
}

export function failedSection<T>(error: unknown, fallback: string): SectionState<T> {
  const shape = (error ?? {}) as DatabaseErrorShape
  return isMissingSchemaError(shape)
    ? { status: 'unavailable', data: null, message: UNAVAILABLE_MESSAGE, refreshing: false }
    : { status: 'error', data: null, message: fallback, refreshing: false }
}

/* Comparações --------------------------------------------------------------- */

export type ChangeDirection = 'up' | 'down' | 'flat' | 'new' | 'none'

export interface Change {
  direction: ChangeDirection
  /** Variação percentual arredondada; null quando não há base de comparação. */
  percent: number | null
}

/** Variação do período atual sobre o anterior. Base zero não gera percentual. */
export function percentChange(current: number, previous: number): Change {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return { direction: 'none', percent: null }
  if (previous === 0) return current > 0 ? { direction: 'new', percent: null } : { direction: 'none', percent: null }
  const percent = Math.round(((current - previous) / Math.abs(previous)) * 100)
  if (percent === 0) return { direction: 'flat', percent: 0 }
  return { direction: percent > 0 ? 'up' : 'down', percent }
}

/** "+18% vs 30 dias anteriores", "sem variação…", "sem vendas nos 30 dias anteriores". */
export function describeChange(change: Change, period: number, emptyPrevious = 'sem registros'): string {
  const base = `${period} dias anteriores`
  if (change.direction === 'new' || change.direction === 'none') return `${emptyPrevious} nos ${base}`
  if (change.direction === 'flat') return `igual aos ${base}`
  const sign = change.direction === 'up' ? '+' : '−'
  return `${sign}${Math.abs(change.percent ?? 0)}% vs ${base}`
}

/** Tom da variação: crescer é bom para todos os indicadores do painel. */
export function changeTone(change: Change): TileTone {
  if (change.direction === 'up' || change.direction === 'new') return 'success'
  if (change.direction === 'down') return 'error'
  return 'neutral'
}

/* Loja ---------------------------------------------------------------------- */

export const PAID_ORDER_STATUSES = ['ready_for_pickup', 'fulfilled'] as const
export const LOW_STOCK_THRESHOLD = 5

type Named = { name: string } | { name: string }[] | null | undefined

export interface OrderItemRow {
  product_id: string
  quantity: number | string
  unit_price: number | string
  product?: Named
}

export interface PaidOrderRow {
  total_amount: number | string
  created_at: string
  store_order_items?: OrderItemRow[] | null
}

export interface ProductRank {
  id: string
  name: string
  quantity: number
  revenue: number
}

export function relationName(value: Named): string | undefined {
  return Array.isArray(value) ? value[0]?.name : value?.name
}

/** Produtos mais vendidos por quantidade (desempate pela receita, depois pelo nome). */
export function topProducts(orders: readonly PaidOrderRow[], limit = 5): ProductRank[] {
  const totals = new Map<string, ProductRank>()
  for (const item of orders.flatMap(order => order.store_order_items ?? [])) {
    const current = totals.get(item.product_id) ?? { id: item.product_id, name: relationName(item.product) || 'Produto removido', quantity: 0, revenue: 0 }
    const quantity = Number(item.quantity) || 0
    totals.set(item.product_id, {
      ...current,
      quantity: current.quantity + quantity,
      revenue: current.revenue + quantity * (Number(item.unit_price) || 0)
    })
  }
  return [...totals.values()]
    .filter(product => product.quantity > 0)
    .sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue || a.name.localeCompare(b.name, 'pt-BR'))
    .slice(0, Math.max(0, limit))
}

/* Formatação ---------------------------------------------------------------- */

const countFormatter = new Intl.NumberFormat('pt-BR')
const wholeMoneyFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
const compactFormatter = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 })

export function formatCount(value: number | null | undefined): string {
  return value === null || value === undefined || !Number.isFinite(value) ? '—' : countFormatter.format(value)
}

/** Rótulo curto de eixo: "R$ 1,2 mil", "R$ 800". */
export function formatCompactBRL(value: number): string {
  return value >= 1000 ? `R$ ${compactFormatter.format(value)}` : wholeMoneyFormatter.format(value)
}

export function plural(count: number, singular: string, pluralForm: string): string {
  return `${formatCount(count)} ${count === 1 ? singular : pluralForm}`
}

/** "Ana, Bruno e mais 2". */
export function listPreview(names: readonly string[], max = 2): string {
  if (names.length <= max) {
    return names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} e ${names.at(-1)}`
  }
  return `${names.slice(0, max).join(', ')} e mais ${names.length - max}`
}

/* Atalhos ------------------------------------------------------------------- */

export interface DashboardShortcut {
  id: string
  label: string
  icon: string
  to: string
}

interface ShortcutRule extends DashboardShortcut {
  allowed: (profile: SessionProfile | null) => boolean
}

const canManageStock = (profile: SessionProfile | null) => canManageChurch(profile) || hasRole(profile, 'cashier')

const SHORTCUT_RULES: readonly ShortcutRule[] = [
  { id: 'content', label: 'Nova publicação', icon: 'i-lucide-megaphone', to: '/admin/conteudo?novo=1', allowed: canManageChurch },
  { id: 'event', label: 'Novo evento', icon: 'i-lucide-calendar-plus', to: '/admin/agenda?novo=1', allowed: canManageChurch },
  { id: 'people', label: 'Pessoas e papéis', icon: 'i-lucide-users-round', to: '/admin/pessoas', allowed: canManageChurch },
  { id: 'cash', label: 'Caixa e pedidos', icon: 'i-lucide-package-check', to: '/operacao', allowed: canOperateStore },
  { id: 'stock', label: 'Estoque', icon: 'i-lucide-boxes', to: '/operacao/estoque', allowed: canManageStock },
  { id: 'reports', label: 'Relatórios', icon: 'i-lucide-chart-no-axes-combined', to: '/operacao/relatorios', allowed: canManageStock },
  { id: 'children', label: 'Turmas infantis', icon: 'i-lucide-sprout', to: '/sementinhas/turmas', allowed: canTeachChildren },
  { id: 'cells', label: 'Células', icon: 'i-lucide-house-heart', to: '/celulas', allowed: profile => profile !== null },
  { id: 'audit', label: 'Auditoria', icon: 'i-lucide-scroll-text', to: '/admin/auditoria', allowed: canManageChurch }
]

/** Atalhos que o papel atual pode abrir (as rotas repetem a mesma checagem no middleware). */
export function dashboardShortcuts(profile: SessionProfile | null): DashboardShortcut[] {
  return SHORTCUT_RULES
    .filter(rule => rule.allowed(profile))
    .map(({ allowed: _allowed, ...shortcut }) => shortcut)
}
