export type SystemRole = 'member' | 'administrator' | 'pastor'
export type MinistryRole = 'leader' | 'member'
export type CommunityVisibility = 'members' | 'private'
export type EventKind = 'service' | 'event' | 'meeting' | 'rehearsal' | 'activity'
export type ReminderLead = 'week' | 'day' | 'hour'
export type CellAccessState = 'invited' | 'member' | 'leader' | 'manager'
export type CellInvitationStatus = 'pending' | 'accepted' | 'declined' | 'revoked'
export type CellAnnouncementStatus = 'draft' | 'published' | 'archived'
export type CellPollStatus = 'draft' | 'published' | 'closed'

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

export interface CellSummary {
  id: string
  name: string
  description?: string
  meetingWeekday?: number
  meetingTime?: string
  access: CellAccessState
  active: boolean
  pendingInvitationId?: string
  demo?: boolean
}

export interface CellAddress {
  addressLine: string
  city: string
  region: string
  postalCode?: string
}

export interface CellMember {
  userId: string
  name: string
  email: string
  isLeader: boolean
}

export interface CellInvitation {
  id: string
  cellId: string
  email: string
  status: CellInvitationStatus
  createdAt: string
}

export interface CellAnnouncement {
  id: string
  cellId: string
  title: string
  body: string
  status: CellAnnouncementStatus
  createdAt: string
}

export interface CellPollOption {
  id: string
  label: string
  position: number
  votes: number
}

export interface CellPoll {
  id: string
  cellId: string
  question: string
  status: CellPollStatus
  options: CellPollOption[]
  selectedOptionId?: string
  createdAt: string
}

export interface CellDetail extends CellSummary {
  address?: CellAddress
  members: CellMember[]
  invitations: CellInvitation[]
  announcements: CellAnnouncement[]
  polls: CellPoll[]
}
