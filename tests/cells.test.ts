import { describe, expect, it } from 'vitest'
import { aggregatePollVotes, cellScheduleLabel, normalizeInvitationEmail, resolveCellAccess } from '../app/utils/cells'
import type { SessionProfile } from '../app/types/domain'

const member: SessionProfile = { id: 'member', name: 'Membro', email: 'member@example.test', roles: ['member'], isApprovedGuardian: false, isChildrenTeam: false }

describe('cell domain helpers', () => {
  it('formats schedules without inventing missing time data', () => {
    expect(cellScheduleLabel(3, '20:00:00')).toBe('Quarta-feira, 20:00')
    expect(cellScheduleLabel()).toBe('Horário a definir')
  })

  it('resolves the strongest authorized cell access state', () => {
    expect(resolveCellAccess({ ...member, roles: ['pastor'] }, false)).toBe('manager')
    expect(resolveCellAccess(member, true, 'approved')).toBe('leader')
    expect(resolveCellAccess(member, false, 'approved')).toBe('member')
    expect(resolveCellAccess(member, false, undefined, true)).toBe('invited')
    expect(resolveCellAccess(member, false)).toBeNull()
  })

  it('aggregates valid vote totals by option', () => {
    const options = [
      { id: 'a', label: 'A', position: 0 },
      { id: 'b', label: 'B', position: 1 }
    ]
    expect(aggregatePollVotes(options, ['a', 'a', 'b'])).toEqual([
      { ...options[0], votes: 2 },
      { ...options[1], votes: 1 }
    ])
  })

  it('normalizes invitation e-mails for the database constraint', () => {
    expect(normalizeInvitationEmail('  Pessoa@Example.TEST ')).toBe('pessoa@example.test')
  })
})
