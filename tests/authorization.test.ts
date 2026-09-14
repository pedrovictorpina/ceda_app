import { describe, expect, it } from 'vitest'
import { canAccessChildren, canManageChurch, hasRole } from '../app/utils/authorization'
import type { SessionProfile } from '../app/types/domain'

const member: SessionProfile = { id: '1', name: 'Membro', email: 'member@example.test', roles: ['member'], isApprovedGuardian: false, isChildrenTeam: false }

describe('frontend authorization helpers', () => {
  it('keeps ordinary members out of management', () => {
    expect(canManageChurch(member)).toBe(false)
    expect(hasRole(member, 'member')).toBe(true)
  })

  it('allows pastors and administrators to manage', () => {
    expect(canManageChurch({ ...member, roles: ['pastor'] })).toBe(true)
    expect(canManageChurch({ ...member, roles: ['administrator'] })).toBe(true)
  })

  it('exposes children only to approved guardians, team, or administrators', () => {
    expect(canAccessChildren(member)).toBe(false)
    expect(canAccessChildren({ ...member, isApprovedGuardian: true })).toBe(true)
    expect(canAccessChildren({ ...member, isChildrenTeam: true })).toBe(true)
    expect(canAccessChildren({ ...member, roles: ['administrator'] })).toBe(true)
  })
})
