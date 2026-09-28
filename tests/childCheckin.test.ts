import { describe, expect, it } from 'vitest'
import {
  activeCheckinFor,
  alertReasonLabel,
  dateKeyInTimeZone,
  describeCheckinStatus,
  formatClockTime,
  formatElapsed,
  isCheckinActive,
  latestAlertByCheckin,
  pendingAlerts,
  validateAlertInput
} from '../app/utils/childCheckin'
import { childInitials, childPhotoPath, validateChildPhoto } from '../app/utils/childPhoto'
import { friendlyDatabaseError } from '../app/utils/databaseErrors'

// 28/09/2026 20:00 em Brasília (UTC-3).
const now = new Date('2026-09-28T23:00:00Z')

describe('service day', () => {
  it('uses the Brasília calendar day', () => {
    expect(dateKeyInTimeZone(new Date('2026-09-29T02:30:00Z'))).toBe('2026-09-28')
    expect(dateKeyInTimeZone(new Date('2026-09-29T03:30:00Z'))).toBe('2026-09-29')
  })

  it('formats the clock time in Brasília', () => {
    expect(formatClockTime('2026-09-28T22:05:00Z')).toBe('19:05')
    expect(formatClockTime('invalid')).toBe('')
  })

  it('formats elapsed time', () => {
    expect(formatElapsed('2026-09-28T22:59:40Z', now)).toBe('agora')
    expect(formatElapsed('2026-09-28T22:55:00Z', now)).toBe('há 5 min')
    expect(formatElapsed('2026-09-28T21:00:00Z', now)).toBe('há 2 h')
  })
})

describe('check-in status', () => {
  const today = { id: 'a', child_id: 'ana', class_id: 'c', status: 'checked_in' as const, checked_in_at: '2026-09-28T22:05:00Z', checked_out_at: null }
  const forgotten = { ...today, id: 'b', checked_in_at: '2026-09-21T22:05:00Z' }
  const left = { ...today, id: 'c', status: 'checked_out' as const, checked_out_at: '2026-09-28T23:30:00Z' }

  it('only counts open check-ins from today', () => {
    expect(isCheckinActive(today, now)).toBe(true)
    expect(isCheckinActive(forgotten, now)).toBe(false)
    expect(isCheckinActive(left, now)).toBe(false)
  })

  it('finds the active check-in of a child', () => {
    expect(activeCheckinFor([forgotten, left, today], 'ana', now)?.id).toBe('a')
    expect(activeCheckinFor([forgotten], 'ana', now)).toBeUndefined()
  })

  it('describes the status for guardians', () => {
    expect(describeCheckinStatus(today, 'Turma Jardim', now)).toBe('Na salinha desde 19:05 — Turma Jardim')
    expect(describeCheckinStatus(today, undefined, now)).toBe('Na salinha desde 19:05')
    expect(describeCheckinStatus(forgotten, 'Turma Jardim', now)).toBe('Fora da salinha')
    expect(describeCheckinStatus(undefined, undefined, now)).toBe('Fora da salinha')
  })
})

describe('alerts', () => {
  it('labels reasons', () => {
    expect(alertReasonLabel('crying')).toBe('Está chorando')
    expect(alertReasonLabel(null)).toBe('Chamado da salinha')
  })

  it('validates the reason and note', () => {
    expect(validateAlertInput(null, '')).toBe('Escolha o motivo do alerta.')
    expect(validateAlertInput('other', '  ')).toBe('Descreva o motivo do alerta.')
    expect(validateAlertInput('needs_you', 'x'.repeat(201))).toBe('A mensagem deve ter até 200 caracteres.')
    expect(validateAlertInput('needs_you', '')).toBeNull()
  })

  it('lists pending alerts newest first without mutating the input', () => {
    const alerts = [
      { id: '1', acknowledged_at: null, created_at: '2026-09-28T22:10:00Z' },
      { id: '2', acknowledged_at: '2026-09-28T22:12:00Z', created_at: '2026-09-28T22:11:00Z' },
      { id: '3', acknowledged_at: null, created_at: '2026-09-28T22:20:00Z' }
    ]
    expect(pendingAlerts(alerts).map(alert => alert.id)).toEqual(['3', '1'])
    expect(alerts[0]?.id).toBe('1')
  })

  it('summarises the latest send per check-in across guardians', () => {
    const sentAt = '2026-09-28T22:20:00Z'
    const summary = latestAlertByCheckin([
      { checkin_id: 'x', created_at: '2026-09-28T22:10:00Z', acknowledged_at: '2026-09-28T22:11:00Z' },
      { checkin_id: 'x', created_at: sentAt, acknowledged_at: null },
      { checkin_id: 'x', created_at: sentAt, acknowledged_at: '2026-09-28T22:21:00Z' },
      { checkin_id: null, created_at: sentAt, acknowledged_at: null }
    ])
    expect(summary.size).toBe(1)
    expect(summary.get('x')).toMatchObject({ alert: { created_at: sentAt }, acknowledgedAt: '2026-09-28T22:21:00Z' })
  })
})

describe('child photos', () => {
  it('accepts only small images', () => {
    expect(validateChildPhoto({ type: 'image/png', size: 1000 })).toBeNull()
    expect(validateChildPhoto({ type: 'image/gif', size: 1000 })).toBe('Escolha uma foto JPG, PNG ou WebP.')
    expect(validateChildPhoto({ type: 'image/jpeg', size: 6 * 1024 * 1024 })).toBe('A foto deve ter até 5 MB.')
  })

  it('stores photos inside the child folder', () => {
    expect(childPhotoPath('child-1', 'image/webp', 'abc')).toBe('child-1/abc.webp')
    expect(() => childPhotoPath('child-1', 'image/gif', 'abc')).toThrow()
  })

  it('builds initials', () => {
    expect(childInitials('ana clara souza')).toBe('AC')
    expect(childInitials('  ')).toBe('?')
  })
})

describe('database errors', () => {
  it('shows messages written for members', () => {
    expect(friendlyDatabaseError({ code: 'P0001', message: 'Esta criança já está na salinha.' }, 'Falhou')).toBe('Esta criança já está na salinha.')
    expect(friendlyDatabaseError({ code: '42501', message: 'Você não é responsável por esta criança.' }, 'Falhou')).toBe('Você não é responsável por esta criança.')
  })

  it('hides technical messages', () => {
    expect(friendlyDatabaseError({ code: '42501', message: 'new row violates row-level security policy' }, 'Falhou')).toBe('Falhou')
    expect(friendlyDatabaseError({ code: '23505', message: 'duplicate key value' }, 'Falhou')).toBe('Esse registro já existe.')
    expect(friendlyDatabaseError({ code: 'XX000', message: 'boom' }, 'Falhou')).toBe('Falhou')
    expect(friendlyDatabaseError(null, 'Falhou')).toBe('Falhou')
  })
})
