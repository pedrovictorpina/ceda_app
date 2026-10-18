import { describe, expect, it } from 'vitest'
import { canAccessChildren, canManageChurch, canOperateStore, canTeachChildren, hasRole } from '../app/utils/authorization'
import { normalizeSystemRoles } from '../app/utils/systemRoles'
import type { SessionProfile } from '../app/types/domain'

const member: SessionProfile = { id: '1', name: 'Membro', email: 'member@example.test', roles: ['member'], isApprovedGuardian: false, isChildrenTeam: false }

describe('frontend authorization helpers', () => {
  it.each(['cashier', 'counter'] as const)('allows the %s store operator to receive payments and deliver orders', (role) => {
    const operator = { ...member, roles: ['member', role] as const }
    const profile = { ...operator, roles: [...operator.roles] }
    expect(hasRole(profile, 'cashier')).toBe(true)
    expect(hasRole(profile, 'counter')).toBe(true)
    expect(canOperateStore(profile)).toBe(true)
    expect(canManageChurch(profile)).toBe(false)
    expect(canTeachChildren(profile)).toBe(false)
  })

  it('keeps store operations away from members and signed-out visitors', () => {
    expect(canOperateStore(member)).toBe(false)
    expect(canOperateStore(null)).toBe(false)
    expect(hasRole(null, 'cashier')).toBe(false)
    expect(canOperateStore({ ...member, roles: ['pastor'] })).toBe(true)
    expect(canOperateStore({ ...member, roles: ['administrator'] })).toBe(true)
  })

  it('presents a single store permission while preserving other valid roles', () => {
    expect(normalizeSystemRoles(['member', 'counter', 'cashier', 'teacher', 'administrator', 'pastor', 'unknown', null]))
      .toEqual(['member', 'cashier', 'teacher', 'administrator', 'pastor'])
    expect(normalizeSystemRoles(undefined)).toEqual([])
    expect(normalizeSystemRoles({ administrator: true })).toEqual([])
  })

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
