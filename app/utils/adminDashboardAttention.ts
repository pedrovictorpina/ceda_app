import { LOW_STOCK_THRESHOLD, listPreview, plural } from './adminDashboard'
import { CHURCH_TIME_ZONE } from './birthdays'

export type AttentionTone = 'warning' | 'primary' | 'neutral'

export interface AttentionItem {
  id: string
  icon: string
  title: string
  detail: string
  to: string
  tone: AttentionTone
  count: number
}

export interface LowStockEntry {
  name: string
  stock: number
}

export interface DatedTitle {
  title: string
  at: string
}

export interface VisitRequestsSummary {
  count: number
  cellIds: string[]
}

/** Cada campo é null quando a fonte não carregou; a lista ignora esses itens. */
export interface AttentionInput {
  pendingMemberships?: number | null
  pendingVisits?: VisitRequestsSummary | null
  awaitingOrders?: number | null
  lowStock?: readonly LowStockEntry[] | null
  pastoralPrayers?: number | null
  scheduledToday?: readonly DatedTitle[] | null
  eventsThisWeek?: readonly DatedTitle[] | null
  drafts?: number | null
}

const moment = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: CHURCH_TIME_ZONE })
const clock = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: CHURCH_TIME_ZONE })

function formatMoment(iso: string, formatter: Intl.DateTimeFormat) {
  const date = new Date(iso)
  return Number.isNaN(date.valueOf()) ? '' : formatter.format(date)
}

function memberships(count: number): AttentionItem {
  return {
    id: 'memberships',
    icon: 'i-lucide-user-round-plus',
    title: plural(count, 'solicitação de participação', 'solicitações de participação'),
    detail: 'Aprove ou recuse a entrada nas comunidades.',
    to: '/admin/pessoas?view=pending',
    tone: 'warning',
    count
  }
}

function visits(summary: VisitRequestsSummary): AttentionItem {
  const singleCell = summary.cellIds.length === 1 ? summary.cellIds[0] : undefined
  return {
    id: 'visits',
    icon: 'i-lucide-door-open',
    title: plural(summary.count, 'pedido de visita aguardando contato', 'pedidos de visita aguardando contato'),
    detail: singleCell ? 'Todos na mesma célula.' : `Em ${plural(summary.cellIds.length, 'célula', 'células')}.`,
    to: singleCell ? `/celulas/${singleCell}` : '/celulas',
    tone: 'warning',
    count: summary.count
  }
}

function orders(count: number): AttentionItem {
  return {
    id: 'orders',
    icon: 'i-lucide-receipt',
    title: plural(count, 'pedido aguardando o caixa', 'pedidos aguardando o caixa'),
    detail: 'Confirme o pagamento ou cancele para liberar o estoque.',
    to: '/operacao',
    tone: 'warning',
    count
  }
}

function stock(entries: readonly LowStockEntry[]): AttentionItem {
  const sorted = [...entries].sort((a, b) => a.stock - b.stock)
  return {
    id: 'stock',
    icon: 'i-lucide-package-minus',
    title: plural(entries.length, 'produto com estoque baixo', 'produtos com estoque baixo'),
    detail: `${listPreview(sorted.map(entry => entry.name))}: até ${LOW_STOCK_THRESHOLD} unidades.`,
    to: '/operacao/estoque',
    tone: 'warning',
    count: entries.length
  }
}

function prayers(count: number): AttentionItem {
  return {
    id: 'prayers',
    icon: 'i-lucide-heart-handshake',
    title: plural(count, 'pedido de oração para a equipe pastoral', 'pedidos de oração para a equipe pastoral'),
    detail: 'Pedidos ativos compartilhados com a pastoral.',
    to: '/oracao',
    tone: 'primary',
    count
  }
}

function scheduled(items: readonly DatedTitle[]): AttentionItem {
  const first = items[0]!
  const time = formatMoment(first.at, clock)
  return {
    id: 'scheduled',
    icon: 'i-lucide-calendar-clock',
    title: plural(items.length, 'publicação agendada para hoje', 'publicações agendadas para hoje'),
    detail: time ? `Próxima: ${first.title}, às ${time}.` : `Próxima: ${first.title}.`,
    to: '/admin/conteudo',
    tone: 'primary',
    count: items.length
  }
}

function events(items: readonly DatedTitle[]): AttentionItem {
  const first = items[0]!
  const when = formatMoment(first.at, moment)
  return {
    id: 'events',
    icon: 'i-lucide-calendar-days',
    title: plural(items.length, 'evento nos próximos 7 dias', 'eventos nos próximos 7 dias'),
    detail: when ? `Próximo: ${first.title}, ${when}.` : `Próximo: ${first.title}.`,
    to: '/admin/agenda',
    tone: 'neutral',
    count: items.length
  }
}

function drafts(count: number): AttentionItem {
  return {
    id: 'drafts',
    icon: 'i-lucide-file-pen-line',
    title: plural(count, 'rascunho sem publicar', 'rascunhos sem publicar'),
    detail: 'Revise e publique ou agende.',
    to: '/admin/conteudo',
    tone: 'neutral',
    count
  }
}

const positive = (value: number | null | undefined): value is number => typeof value === 'number' && value > 0
const hasItems = <T>(value: readonly T[] | null | undefined): value is readonly T[] => Array.isArray(value) && value.length > 0

/** Itens acionáveis em ordem de urgência; fontes vazias ou indisponíveis ficam de fora. */
export function buildAttentionItems(input: AttentionInput): AttentionItem[] {
  const items: Array<AttentionItem | null> = [
    positive(input.pendingMemberships) ? memberships(input.pendingMemberships) : null,
    input.pendingVisits && input.pendingVisits.count > 0 ? visits(input.pendingVisits) : null,
    positive(input.awaitingOrders) ? orders(input.awaitingOrders) : null,
    hasItems(input.lowStock) ? stock(input.lowStock) : null,
    positive(input.pastoralPrayers) ? prayers(input.pastoralPrayers) : null,
    hasItems(input.scheduledToday) ? scheduled(input.scheduledToday) : null,
    hasItems(input.eventsThisWeek) ? events(input.eventsThisWeek) : null,
    positive(input.drafts) ? drafts(input.drafts) : null
  ]
  return items.filter((item): item is AttentionItem => item !== null)
}

/** Quantidade de itens que pedem decisão (tom de alerta). */
export function urgentCount(items: readonly AttentionItem[]): number {
  return items.filter(item => item.tone === 'warning').reduce((total, item) => total + item.count, 0)
}
