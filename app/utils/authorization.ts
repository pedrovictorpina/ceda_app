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

/** Professores formam a equipe infantil; a tabela legada children_team_members continua valendo. */
export function canTeachChildren(profile: SessionProfile | null): boolean {
  return hasRole(profile, 'administrator') || hasRole(profile, 'teacher') || profile?.isChildrenTeam === true
}

/**
 * Todo membro autenticado pode abrir o Sementinhas para cadastrar os próprios
 * filhos; o banco (RLS) limita cada pessoa às crianças sob sua responsabilidade.
 */
export function canAccessChildren(profile: SessionProfile | null): boolean {
  return profile !== null
}
