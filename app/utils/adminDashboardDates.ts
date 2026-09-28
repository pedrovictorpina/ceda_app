import { CHURCH_TIME_ZONE, parseIsoDate, todayInTimeZone } from './birthdays'

/** Períodos oferecidos no seletor do painel administrativo, em dias. */
export const DASHBOARD_PERIODS = [7, 30, 90] as const
export type DashboardPeriod = typeof DASHBOARD_PERIODS[number]
export const DEFAULT_DASHBOARD_PERIOD: DashboardPeriod = 30

export type BucketGranularity = 'day' | 'week'

/** Janela atual e a janela imediatamente anterior, com o mesmo tamanho (datas AAAA-MM-DD). */
export interface DashboardWindow {
  period: DashboardPeriod
  today: string
  start: string
  previousStart: string
  previousEnd: string
}

export interface SeriesBucket {
  key: string
  /** Rótulo curto do eixo ("22/09"). */
  label: string
  /** Rótulo completo para dica e tabela ("Semana de 22/09" ou "seg., 22/09"). */
  fullLabel: string
}

export interface SeriesPoint extends SeriesBucket {
  value: number
}

export interface DatedValue {
  /** Instante ISO (timestamptz) ou data AAAA-MM-DD. */
  at: string
  value?: number
}

const DAY_MS = 86_400_000
const ISO_DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/
const dateKeyFormatters = new Map<string, Intl.DateTimeFormat>()
const offsetFormatters = new Map<string, Intl.DateTimeFormat>()
const shortDayFormatter = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' })
const weekdayFormatter = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', timeZone: 'UTC' })

export function isDashboardPeriod(value: unknown): value is DashboardPeriod {
  return typeof value === 'number' && (DASHBOARD_PERIODS as readonly number[]).includes(value)
}

function requireTime(dateKey: string) {
  const time = parseIsoDate(dateKey)
  if (time === null) throw new RangeError(`Data inválida: ${dateKey}`)
  return time
}

/** Soma dias a uma data AAAA-MM-DD sem depender do fuso do aparelho. */
export function shiftDateKey(dateKey: string, days: number): string {
  return new Date(requireTime(dateKey) + days * DAY_MS).toISOString().slice(0, 10)
}

/** Segunda-feira da semana (segunda a domingo) que contém a data. */
export function weekStartKey(dateKey: string): string {
  const weekday = new Date(requireTime(dateKey)).getUTCDay()
  return shiftDateKey(dateKey, -((weekday + 6) % 7))
}

/** Data AAAA-MM-DD de um instante no fuso da igreja. Datas puras são mantidas. */
export function zonedDateKey(value: string | Date, timeZone = CHURCH_TIME_ZONE): string | null {
  if (typeof value === 'string' && ISO_DATE_ONLY.test(value)) return parseIsoDate(value) === null ? null : value
  const moment = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(moment.valueOf())) return null
  let formatter = dateKeyFormatters.get(timeZone)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone })
    dateKeyFormatters.set(timeZone, formatter)
  }
  return formatter.format(moment)
}

/** Deslocamento "-03:00" do fuso num instante (considera horário de verão, se voltar a existir). */
function zoneOffset(time: number, timeZone: string) {
  let formatter = offsetFormatters.get(timeZone)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' })
    offsetFormatters.set(timeZone, formatter)
  }
  const name = formatter.formatToParts(time).find(part => part.type === 'timeZoneName')?.value ?? 'GMT'
  const offset = name.replace('GMT', '')
  return offset === '' ? '+00:00' : offset
}

/** Instante ISO (UTC) da meia-noite da data no fuso da igreja, para filtros `gte`/`lt`. */
export function zonedMidnightIso(dateKey: string, timeZone = CHURCH_TIME_ZONE): string {
  const offset = zoneOffset(requireTime(dateKey) + 12 * 3_600_000, timeZone)
  return new Date(`${dateKey}T00:00:00${offset}`).toISOString()
}

/** Janela de `period` dias terminando hoje (inclusive) e a janela anterior de mesmo tamanho. */
export function dashboardWindow(period: DashboardPeriod, now: Date = new Date(), timeZone = CHURCH_TIME_ZONE): DashboardWindow {
  const today = todayInTimeZone(now, timeZone)
  const start = shiftDateKey(today, -(period - 1))
  return {
    period,
    today,
    start,
    previousStart: shiftDateKey(start, -period),
    previousEnd: shiftDateKey(start, -1)
  }
}

/** Sete dias em barras diárias; períodos maiores em semanas (os cultos são semanais). */
export function bucketGranularity(period: DashboardPeriod): BucketGranularity {
  return period <= 7 ? 'day' : 'week'
}

function shortDay(dateKey: string) {
  return shortDayFormatter.format(requireTime(dateKey))
}

/**
 * Semana cortada pela janela (primeira ou atual): o rótulo mostra os dias
 * realmente contados, para não comparar uma semana de 1 dia com uma inteira.
 */
function weekLabels(weekStart: string, start: string, end: string) {
  const from = weekStart < start ? start : weekStart
  const weekEnd = shiftDateKey(weekStart, 6)
  const to = weekEnd > end ? end : weekEnd
  const days = Math.round((requireTime(to) - requireTime(from)) / DAY_MS) + 1
  const label = shortDay(from)
  if (days === 7) return { label, fullLabel: `Semana de ${label}` }
  if (days === 1) return { label, fullLabel: `${label} (1 dia)` }
  return { label, fullLabel: `${label} a ${shortDay(to)} (${days} dias)` }
}

/** Baldes consecutivos de `start` até `end`. Semanas começam na segunda-feira. */
export function buildBuckets(start: string, end: string, granularity: BucketGranularity): SeriesBucket[] {
  if (start > end) return []
  const step = granularity === 'day' ? 1 : 7
  const first = granularity === 'day' ? start : weekStartKey(start)
  const buckets: SeriesBucket[] = []
  for (let key = first; key <= end; key = shiftDateKey(key, step)) {
    const labels = granularity === 'day'
      ? { label: shortDay(key), fullLabel: `${weekdayFormatter.format(requireTime(key))} ${shortDay(key)}` }
      : weekLabels(key, start, end)
    buckets.push({ key, ...labels })
  }
  return buckets
}

function bucketKeyFor(dateKey: string, granularity: BucketGranularity) {
  return granularity === 'day' ? dateKey : weekStartKey(dateKey)
}

/**
 * Soma os registros em cada balde (sem `value`, cada registro conta 1).
 * Registros fora de [start, end] ou com data inválida são ignorados.
 */
export function bucketSeries(
  records: readonly DatedValue[],
  range: { start: string, end: string },
  granularity: BucketGranularity,
  timeZone = CHURCH_TIME_ZONE
): SeriesPoint[] {
  const buckets = buildBuckets(range.start, range.end, granularity)
  const totals = new Map(buckets.map(bucket => [bucket.key, 0]))
  for (const record of records) {
    const key = zonedDateKey(record.at, timeZone)
    if (!key || key < range.start || key > range.end) continue
    const bucketKey = bucketKeyFor(key, granularity)
    totals.set(bucketKey, (totals.get(bucketKey) ?? 0) + Number(record.value ?? 1))
  }
  return buckets.map(bucket => ({ ...bucket, value: totals.get(bucket.key) ?? 0 }))
}

/** Soma dos registros com data (no fuso da igreja) entre `start` e `end`, inclusive. */
export function sumInRange(records: readonly DatedValue[], start: string, end: string, timeZone = CHURCH_TIME_ZONE): number {
  return records.reduce((total, record) => {
    const key = zonedDateKey(record.at, timeZone)
    return key && key >= start && key <= end ? total + Number(record.value ?? 1) : total
  }, 0)
}

export function seriesTotal(points: readonly SeriesPoint[]): number {
  return points.reduce((total, point) => total + point.value, 0)
}

/** Ponto de maior valor (o primeiro, em caso de empate); null se a série estiver vazia ou zerada. */
export function peakPoint(points: readonly SeriesPoint[]): SeriesPoint | null {
  const peak = points.reduce<SeriesPoint | null>((best, point) => (!best || point.value > best.value ? point : best), null)
  return peak && peak.value > 0 ? peak : null
}

export function isEmptySeries(points: readonly SeriesPoint[]): boolean {
  return points.every(point => point.value === 0)
}

/** Teto "redondo" para o eixo: 1, 2 ou 5 × 10ⁿ, igual ou acima do máximo. */
export function niceCeiling(max: number): number {
  if (!Number.isFinite(max) || max <= 0) return 1
  const magnitude = 10 ** Math.floor(Math.log10(max))
  const step = [1, 2, 5, 10].find(factor => factor * magnitude >= max) ?? 10
  return step * magnitude
}

/** Marcas do eixo Y: zero, metade e teto; em contagens, somente valores inteiros. */
export function axisTicks(max: number, integer = true): number[] {
  const ceiling = niceCeiling(integer ? Math.ceil(max) : max)
  return [0, ceiling / 2, ceiling].filter(tick => !integer || Number.isInteger(tick))
}
