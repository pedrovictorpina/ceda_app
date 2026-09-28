import type { ChildAlert, ChildAlertReason, ChildCheckin } from '~/types/children'

/** Os cultos acontecem no horário de Brasília; "hoje" segue esse fuso. */
export const CHILDREN_TIME_ZONE = 'America/Sao_Paulo'
export const ALERT_NOTE_MAX = 200

export const CHILD_ALERT_REASONS: ReadonlyArray<{ value: ChildAlertReason, label: string, icon: string }> = [
  { value: 'needs_you', label: 'Precisa de você na sala', icon: 'i-lucide-hand-heart' },
  { value: 'clothing_change', label: 'Troca de roupa/fralda', icon: 'i-lucide-shirt' },
  { value: 'crying', label: 'Está chorando', icon: 'i-lucide-frown' },
  { value: 'minor_injury', label: 'Machucou-se levemente', icon: 'i-lucide-bandage' },
  { value: 'other', label: 'Outro motivo', icon: 'i-lucide-message-circle-more' }
]

const dateKeyFormatters = new Map<string, Intl.DateTimeFormat>()
const clockFormatter = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: CHILDREN_TIME_ZONE })

/** Data "AAAA-MM-DD" de um instante no fuso informado. */
export function dateKeyInTimeZone(date: Date, timeZone = CHILDREN_TIME_ZONE): string {
  let formatter = dateKeyFormatters.get(timeZone)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone })
    dateKeyFormatters.set(timeZone, formatter)
  }
  return formatter.format(date)
}

export function isSameServiceDay(iso: string, now = new Date()): boolean {
  const moment = new Date(iso)
  if (Number.isNaN(moment.valueOf())) return false
  return dateKeyInTimeZone(moment) === dateKeyInTimeZone(now)
}

export function formatClockTime(iso: string): string {
  const moment = new Date(iso)
  return Number.isNaN(moment.valueOf()) ? '' : clockFormatter.format(moment)
}

/** "agora", "há 3 min", "há 1 h". */
export function formatElapsed(iso: string, now = new Date()): string {
  const minutes = Math.floor((now.getTime() - new Date(iso).getTime()) / 60000)
  if (!Number.isFinite(minutes) || minutes < 1) return 'agora'
  if (minutes < 60) return `há ${minutes} min`
  return `há ${Math.floor(minutes / 60)} h`
}

/** Check-in aberto hoje; um check-in esquecido de outro dia não conta. */
export function isCheckinActive(checkin: Pick<ChildCheckin, 'status' | 'checked_in_at'>, now = new Date()): boolean {
  return checkin.status === 'checked_in' && isSameServiceDay(checkin.checked_in_at, now)
}

export function activeCheckinFor<T extends Pick<ChildCheckin, 'child_id' | 'status' | 'checked_in_at'>>(
  checkins: readonly T[],
  childId: string,
  now = new Date()
): T | undefined {
  return checkins.find(checkin => checkin.child_id === childId && isCheckinActive(checkin, now))
}

/** "Na salinha desde 19:05 — Turma Jardim" ou "Fora da salinha". */
export function describeCheckinStatus(
  checkin: Pick<ChildCheckin, 'status' | 'checked_in_at'> | undefined,
  className: string | undefined,
  now = new Date()
): string {
  if (!checkin || !isCheckinActive(checkin, now)) return 'Fora da salinha'
  const since = `Na salinha desde ${formatClockTime(checkin.checked_in_at)}`
  return className ? `${since} — ${className}` : since
}

export function alertReasonLabel(reason: ChildAlertReason | null | undefined): string {
  return CHILD_ALERT_REASONS.find(item => item.value === reason)?.label ?? 'Chamado da salinha'
}

export function alertReasonIcon(reason: ChildAlertReason | null | undefined): string {
  return CHILD_ALERT_REASONS.find(item => item.value === reason)?.icon ?? 'i-lucide-bell-ring'
}

export function validateAlertInput(reason: ChildAlertReason | null, note: string): string | null {
  if (!reason) return 'Escolha o motivo do alerta.'
  const trimmed = note.trim()
  if (reason === 'other' && !trimmed) return 'Descreva o motivo do alerta.'
  if (trimmed.length > ALERT_NOTE_MAX) return `A mensagem deve ter até ${ALERT_NOTE_MAX} caracteres.`
  return null
}

/** Alertas pendentes do responsável, do mais recente para o mais antigo. */
export function pendingAlerts<T extends Pick<ChildAlert, 'acknowledged_at' | 'created_at'>>(alerts: readonly T[]): T[] {
  return alerts
    .filter(alert => !alert.acknowledged_at)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
}

export interface AlertSummary<T> {
  alert: T
  acknowledgedAt: string | null
}

/**
 * Último envio de cada check-in, para a lista da turma. Um envio gera uma linha
 * por responsável; basta um deles confirmar para o envio contar como visto.
 */
export function latestAlertByCheckin<T extends Pick<ChildAlert, 'checkin_id' | 'created_at' | 'acknowledged_at'>>(
  alerts: readonly T[]
): Map<string, AlertSummary<T>> {
  const summaries = new Map<string, AlertSummary<T>>()
  for (const alert of alerts) {
    if (!alert.checkin_id) continue
    const current = summaries.get(alert.checkin_id)
    if (!current || alert.created_at > current.alert.created_at) {
      summaries.set(alert.checkin_id, { alert, acknowledgedAt: alert.acknowledged_at })
    } else if (alert.created_at === current.alert.created_at && !current.acknowledgedAt && alert.acknowledged_at) {
      summaries.set(alert.checkin_id, { ...current, acknowledgedAt: alert.acknowledged_at })
    }
  }
  return summaries
}
