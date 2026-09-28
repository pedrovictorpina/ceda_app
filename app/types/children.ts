export type CheckinStatus = 'checked_in' | 'checked_out' | 'expired'
export type ChildAlertReason = 'needs_you' | 'clothing_change' | 'crying' | 'minor_injury' | 'other'

export interface ChildRecord {
  id: string
  full_name: string
  birth_date: string | null
  allergies: string | null
  photo_path: string | null
}

export interface ChildClass {
  id: string
  name: string
  min_age: number
  max_age: number
  room: string | null
  notes: string | null
  archived_at: string | null
}

export interface ChildCheckin {
  id: string
  child_id: string
  class_id: string
  status: CheckinStatus
  checked_in_at: string
  checked_out_at: string | null
}

export interface ChildAlert {
  id: string
  child_id: string
  class_id: string | null
  checkin_id: string | null
  reason: ChildAlertReason | null
  message: string
  acknowledged_at: string | null
  created_at: string
}

export interface ChildFormValue {
  fullName: string
  birthDate: string
  allergies: string
}

export interface ClassFormValue {
  name: string
  minAge: number
  maxAge: number
  room: string
  notes: string
}
