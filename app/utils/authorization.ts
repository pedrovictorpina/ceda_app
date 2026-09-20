import type { SessionProfile, SystemRole } from '~/types/domain'

export function hasRole(profile: SessionProfile | null, role: SystemRole): boolean {
  return profile?.roles.includes(role) ?? false
}

export function canManageChurch(profile: SessionProfile | null): boolean {
  return hasRole(profile, 'administrator') || hasRole(profile, 'pastor')
}

export function canOperateStore(profile: SessionProfile | null): boolean {
  return canManageChurch(profile) || hasRole(profile, 'cashier') || hasRole(profile, 'counter')
}

export function canAccessChildren(profile: SessionProfile | null): boolean {
  return profile?.isApprovedGuardian === true || profile?.isChildrenTeam === true || hasRole(profile, 'administrator')
}
