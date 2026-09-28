import { formatCount, plural, type Change, type ProductRank } from './adminDashboard'
import { formatBRL } from './storeCart'
import { peakPoint, type BucketGranularity, type SeriesPoint } from './adminDashboardDates'

/** Títulos que dizem a conclusão do gráfico, não apenas o que ele mede. */

function comparison(change: Change): string {
  if (change.direction === 'up') return `, ${change.percent}% a mais que no período anterior`
  if (change.direction === 'down') return `, ${Math.abs(change.percent ?? 0)}% a menos que no período anterior`
  if (change.direction === 'flat') return ', o mesmo que no período anterior'
  return ''
}

function peakText(points: readonly SeriesPoint[], granularity: BucketGranularity, format: (value: number) => string) {
  const peak = peakPoint(points)
  if (!peak) return ''
  const when = granularity === 'day' ? peak.fullLabel : peak.fullLabel.toLocaleLowerCase('pt-BR')
  return `Pico: ${when}, com ${format(peak.value)}.`
}

export function granularityLabel(granularity: BucketGranularity, period: number): string {
  return `${granularity === 'day' ? 'Por dia' : 'Por semana'}, últimos ${period} dias.`
}

export function membersTakeaway(total: number, change: Change, period: number): string {
  if (total === 0) return `Nenhum cadastro novo nos últimos ${period} dias`
  return `${plural(total, 'novo cadastro', 'novos cadastros')} em ${period} dias${comparison(change)}`
}

export function revenueTakeaway(total: number, change: Change, period: number): string {
  if (total === 0) return `Nenhuma venda confirmada nos últimos ${period} dias`
  return `${formatBRL(total)} em vendas confirmadas${comparison(change)}`
}

export function productsTakeaway(ranking: readonly ProductRank[], period: number): string {
  const leader = ranking[0]
  if (!leader) return `Nenhum produto vendido nos últimos ${period} dias`
  return `${leader.name} lidera, com ${plural(leader.quantity, 'unidade vendida', 'unidades vendidas')}`
}

export function checkinsTakeaway(total: number, period: number): string {
  if (total === 0) return `Nenhum check-in no Sementinhas nos últimos ${period} dias`
  return `${plural(total, 'check-in', 'check-ins')} no Sementinhas em ${period} dias`
}

export function seriesSubtitle(points: readonly SeriesPoint[], granularity: BucketGranularity, period: number, format: (value: number) => string = formatCount): string {
  return [granularityLabel(granularity, period), peakText(points, granularity, format)].filter(Boolean).join(' ')
}

/** Resumo em texto para leitores de tela: total, pico e último período. */
export function seriesSummary(points: readonly SeriesPoint[], format: (value: number) => string = formatCount): string {
  if (!points.length) return 'Sem dados no período.'
  const last = points.at(-1)!
  const peak = peakPoint(points)
  const peakPart = peak ? ` Maior valor em ${peak.fullLabel}: ${format(peak.value)}.` : ' Todos os valores são zero.'
  return `${points.length} períodos.${peakPart} Último período, ${last.fullLabel}: ${format(last.value)}.`
}
