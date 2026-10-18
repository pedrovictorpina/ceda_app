import { describe, expect, it } from 'vitest'
import { agendaDateKey, calendarMonthCells, eventCalendarFile, eventsForMonth, formatEditorialDate, reminderDate } from '../app/utils/churchAgenda'
import type { AgendaEvent } from '../app/utils/churchAgenda'
import { editorialPreview } from '../app/utils/editorial'

const event: AgendaEvent = {
  id: 'event-1', title: 'Culto, oração; famílias', kind: 'service', starts_at: '2026-11-01T01:00:00Z',
  ends_at: '2026-11-01T02:30:00Z', location: 'Sede CEDA', description: 'Chegue cedo\nToda a família é bem-vinda.',
  cancelled_at: null, public_visibility: true
}

describe('agenda compartilhada', () => {
  it('usa a data de Brasília mesmo quando o instante UTC pertence ao mês seguinte', () => {
    expect(agendaDateKey(event.starts_at)).toBe('2026-10-31')
    expect(eventsForMonth([event], 2026, 9)).toHaveLength(1)
    expect(eventsForMonth([event], 2026, 10)).toHaveLength(0)
  })
  it('aplica o mesmo mês, tipo e cancelamento aos dados da lista e do calendário', () => {
    const meeting = { ...event, id: 'meeting', kind: 'meeting' as const }
    const cancelled = { ...event, id: 'cancelled', cancelled_at: '2026-10-18T12:00:00Z' }
    expect(eventsForMonth([cancelled, meeting, event], 2026, 9, 'service').map(item => item.id)).toEqual(['event-1'])
  })
  it('produz semanas completas incluindo a virada do ano', () => {
    const cells = calendarMonthCells(2027, 0)
    expect(cells).toHaveLength(42)
    expect(cells[0]).toEqual({ key: '2026-12-27', day: 27, current: false })
    expect(cells.find(cell => cell.key === '2027-01-01')?.current).toBe(true)
  })
  it('considera o dia extra de fevereiro bissexto', () => {
    expect(calendarMonthCells(2028, 1).filter(cell => cell.current)).toHaveLength(29)
  })
  it('não muda a data editorial de um campo sem horário', () => {
    expect(formatEditorialDate('2026-10-18')).toBe('18 de outubro de 2026')
  })
  it('calcula avisos a partir do instante real do evento', () => {
    expect(reminderDate(event.starts_at, 'hour')).toBe('2026-11-01T00:00:00.000Z')
    expect(reminderDate(event.starts_at, 'day')).toBe('2026-10-31T01:00:00.000Z')
    expect(reminderDate(event.starts_at, 'week')).toBe('2026-10-25T01:00:00.000Z')
  })
  it('exporta datas UTC, identificação estável e um alerta para importação no calendário', () => {
    const file = eventCalendarFile(event, 'hour', new Date('2026-10-18T12:00:00Z'))
    expect(file).toContain('DTSTART:20261101T010000Z\r\n')
    expect(file).toContain('DTEND:20261101T023000Z\r\n')
    expect(file).toContain('UID:event-1@ceda\r\n')
    expect(file).toContain('SUMMARY:Culto\\, oração\\; famílias\r\n')
    expect(file).toContain('TRIGGER:-PT1H\r\n')
    expect(file).toContain('DESCRIPTION:Chegue cedo\\nToda a família é bem-vinda.')
    expect(file).toMatch(/END:VCALENDAR\r\n$/)
  })
  it('limita as linhas ICS a 75 octetos sem quebrar caracteres UTF-8', () => {
    const file = eventCalendarFile({ ...event, title: 'Celebração de comunhão '.repeat(20) })
    for (const line of file.split('\r\n')) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75)
    expect(file.replace(/\r\n /g, '')).toContain(`SUMMARY:${'Celebração de comunhão '.repeat(20)}`)
  })
})

describe('prévia editorial compartilhada', () => {
  it('exibe cada parágrafo uma só vez na prévia e na leitura', () => {
    const result = editorialPreview({ title: 'Mensagem', slug: 'mensagem', content: 'Primeiro parágrafo.\n\nSegundo parágrafo.\n\nTerceiro.', message_date: '2026-10-18' })
    expect(result.excerpt).toBe('Primeiro parágrafo.')
    expect(result.body).toEqual(['Segundo parágrafo.', 'Terceiro.'])
    expect(result.readTime).toBe('1 min de leitura')
  })
  it('aceita uma publicação curta sem inventar texto adicional', () => {
    expect(editorialPreview({ title: 'Aviso', slug: 'aviso', content: 'Uma linha.', message_date: '2026-10-18' }).body).toEqual([])
  })
})
