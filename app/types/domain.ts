export type SystemRole = 'member' | 'administrator' | 'pastor'
export type MinistryRole = 'leader' | 'member'
export type CommunityVisibility = 'members' | 'private'
export type EventKind = 'service' | 'event' | 'meeting' | 'rehearsal' | 'activity'
export type ReminderLead = 'week' | 'day' | 'hour'

export interface SessionProfile {
  id: string
  name: string
  email: string
  avatarUrl?: string
  roles: SystemRole[]
  isApprovedGuardian: boolean
  isChildrenTeam: boolean
}

export interface NavigationItem {
  label: string
  icon: string
  to: string
  requires?: SystemRole | 'guardian'
  webOnly?: boolean
}
