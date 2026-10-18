import type { EventKind, ReminderLead } from '~/types/domain'

export const churchTimeZone = 'America/Sao_Paulo'

export interface AgendaEvent {
  id: string
  title: string
  kind: EventKind
  starts_at: string
  ends_at: string | null
  location: string | null
  description: string | null
  cancelled_at: string | null
  public_visibility: boolean
}

export const eventKindLabels: Record<EventKind, string> = {
  service: 'Culto', event: 'Evento', meeting: 'Reunião', rehearsal: 'Ensaio', activity: 'Atividade'
}

export function agendaDateKey(value: string | Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: churchTimeZone, year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date(value))
  const part = (name: string) => parts.find(item => item.type === name)?.value
  return `${part('year')}-${part('month')}-${part('day')}`
}

export function formatAgendaDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: churchTimeZone, weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
  }).format(new Date(value))
}

export function formatEditorialDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: churchTimeZone, day: '2-digit', month: 'long', year: 'numeric'
  }).format(new Date(value.length === 10 ? `${value}T12:00:00-03:00` : value))
}

export function calendarMonthCells(year: number, month: number) {
  const leading = new Date(Date.UTC(year, month, 1)).getUTCDay()
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(Date.UTC(year, month, index - leading + 1, 12))
    return { key: date.toISOString().slice(0, 10), day: date.getUTCDate(), current: date.getUTCMonth() === month }
  })
}

export function eventsForMonth(events: AgendaEvent[], year: number, month: number, kind = 'all') {
  const prefix = `${year}-${String(month + 1).padStart(2, '0')}-`
  return events.filter(event => !event.cancelled_at && agendaDateKey(event.starts_at).startsWith(prefix) && (kind === 'all' || event.kind === kind))
    .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at))
}

export function reminderDate(startsAt: string, lead: ReminderLead) {
  const hours = lead === 'week' ? 168 : lead === 'day' ? 24 : 1
  return new Date(Date.parse(startsAt) - hours * 3_600_000).toISOString()
}

function icsText(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,')
}

export function eventCalendarFile(event: AgendaEvent, lead: ReminderLead = 'day', now = new Date()) {
  const utc = (value: string | Date) => new Date(value).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//CEDA//Agenda//PT-BR', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT',
    `UID:${event.id}@ceda`, `DTSTAMP:${utc(now)}`, `DTSTART:${utc(event.starts_at)}`]
  if (event.ends_at) lines.push(`DTEND:${utc(event.ends_at)}`)
  lines.push(`SUMMARY:${icsText(event.title)}`)
  if (event.location) lines.push(`LOCATION:${icsText(event.location)}`)
  if (event.description) lines.push(`DESCRIPTION:${icsText(event.description)}`)
  lines.push('BEGIN:VALARM', `TRIGGER:-PT${lead === 'week' ? 168 : lead === 'day' ? 24 : 1}H`, 'ACTION:DISPLAY', `DESCRIPTION:${icsText(event.title)}`, 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR')
  // Fold by UTF-8 octets so long Portuguese titles remain valid in calendar apps.
  return lines.map((line) => {
    let result = '', current = '', size = 0
    for (const char of line) {
      const bytes = new TextEncoder().encode(char).length
      if (size + bytes > 75) {
        result += `${current}\r\n`
        current = ' '
        size = 1
      }
      current += char
      size += bytes
    }
    return result + current
  }).join('\r\n') + '\r\n'
}

export function downloadEventCalendar(event: AgendaEvent, lead: ReminderLead) {
  const url = URL.createObjectURL(new Blob([eventCalendarFile(event, lead)], { type: 'text/calendar;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `ceda-${event.id}.ics`
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
