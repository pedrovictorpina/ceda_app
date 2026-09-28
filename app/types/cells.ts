// Tipos do diretório de células, perfil dos líderes e pedidos de visita.

export type CellRelationship = 'leader' | 'member' | 'manager'
export type CellVisitStatus = 'pending' | 'contacted' | 'closed'

export interface CellLeaderProfile {
  userId: string
  name: string
  avatarPath?: string
  bio?: string
  /** E.164 somente dígitos, ex.: 5511999990000. */
  whatsapp?: string
  /** Usuário do Instagram sem @. */
  instagram?: string
}

export interface CellVisitRequestSummary {
  id: string
  status: CellVisitStatus
  createdAt: string
  preferredDate?: string
}

export interface CellDirectoryEntry {
  id: string
  name: string
  description?: string
  meetingWeekday?: number
  meetingTime?: string
  neighborhood?: string
  city?: string
  region?: string
  /** Presente somente quando o endereço completo pode ser exibido para quem consulta. */
  addressLine?: string
  postalCode?: string
  fullAddressVisible: boolean
  showFullAddress: boolean
  relationship: CellRelationship | null
  leaders: CellLeaderProfile[]
  myVisitRequest?: CellVisitRequestSummary
}

export interface CellVisitRequest {
  id: string
  requesterId: string
  requesterName: string
  requesterAvatarPath?: string
  /** Somente quando o solicitante escolheu compartilhar o telefone. */
  requesterPhone?: string
  message?: string
  preferredDate?: string
  status: CellVisitStatus
  createdAt: string
  handledAt?: string
  handledByName?: string
}

export interface CellMemberCandidate {
  id: string
  name: string
  avatarPath?: string
}

export interface CellDetailsFormValue {
  name: string
  description: string
  weekday: number | null
  time: string
  active: boolean
  showFullAddress: boolean
  addressLine: string
  neighborhood: string
  city: string
  region: string
  postalCode: string
}

export interface CellLeaderProfileFormValue {
  bio: string
  whatsapp: string
  instagram: string
}

export interface CellVisitFormValue {
  message: string
  preferredDate: string
  sharePhone: boolean
}

export interface CellDirectoryFilters {
  weekday: number | null
  search: string
}
