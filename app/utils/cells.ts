import type { CellAccessState, CellPollOption, CellSummary, SessionProfile } from '~/types/domain'
import { canManageChurch } from './authorization'

export const CELL_WEEKDAYS = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'] as const

export function cellScheduleLabel(weekday?: number, time?: string): string {
  if (weekday === undefined || !CELL_WEEKDAYS[weekday]) return 'Horário a definir'
  const normalizedTime = time?.slice(0, 5)
  return normalizedTime ? `${CELL_WEEKDAYS[weekday]}, ${normalizedTime}` : CELL_WEEKDAYS[weekday]
}

export function resolveCellAccess(profile: SessionProfile | null, isLeader: boolean, membershipStatus?: string, invited = false): CellAccessState | null {
  if (canManageChurch(profile)) return 'manager'
  if (isLeader) return 'leader'
  if (membershipStatus === 'approved') return 'member'
  if (invited) return 'invited'
  return null
}

export function aggregatePollVotes(options: Omit<CellPollOption, 'votes'>[], optionIds: string[]): CellPollOption[] {
  const counts = new Map<string, number>()
  for (const optionId of optionIds) counts.set(optionId, (counts.get(optionId) || 0) + 1)
  return options.map(option => ({ ...option, votes: counts.get(option.id) || 0 }))
}

export function normalizeInvitationEmail(value: string): string {
  return value.trim().toLowerCase()
}

export const DEMO_CELLS: CellSummary[] = [
  {
    id: 'demo-lider',
    name: 'Célula Esperança',
    description: 'Demonstração do espaço de gestão de líderes.',
    meetingWeekday: 3,
    meetingTime: '20:00',
    access: 'leader',
    active: true,
    demo: true
  },
  {
    id: 'demo-membro',
    name: 'Célula Graça',
    description: 'Demonstração da visão de um membro participante.',
    meetingWeekday: 5,
    meetingTime: '19:30',
    access: 'member',
    active: true,
    demo: true
  },
  {
    id: 'demo-convite',
    name: 'Célula Comunhão',
    description: 'Convite pendente de demonstração; o endereço permanece oculto.',
    meetingWeekday: 2,
    meetingTime: '20:00',
    access: 'invited',
    active: true,
    pendingInvitationId: 'demo-invitation',
    demo: true
  }
]
