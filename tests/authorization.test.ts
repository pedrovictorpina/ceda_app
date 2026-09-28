import { describe, expect, it } from 'vitest'
import { canAccessChildren, canManageChurch, canTeachChildren, hasRole } from '../app/utils/authorization'
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

  it('lets every signed-in member open Sementinhas to register their own children', () => {
    expect(canAccessChildren(null)).toBe(false)
    expect(canAccessChildren(member)).toBe(true)
  })

  it('treats teachers, the legacy children team and administrators as children staff', () => {
    expect(canTeachChildren(member)).toBe(false)
    expect(canTeachChildren({ ...member, isApprovedGuardian: true })).toBe(false)
    expect(canTeachChildren({ ...member, roles: ['member', 'teacher'] })).toBe(true)
    expect(canTeachChildren({ ...member, isChildrenTeam: true })).toBe(true)
    expect(canTeachChildren({ ...member, roles: ['administrator'] })).toBe(true)
    expect(canTeachChildren({ ...member, roles: ['pastor'] })).toBe(false)
  })
})
