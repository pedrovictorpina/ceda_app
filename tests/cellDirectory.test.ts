import { describe, expect, it } from 'vitest'
import type { CellDirectoryEntry } from '../app/types/cells'
import {
  addDays,
  canRequestVisit,
  cellErrorMessage,
  cellShortScheduleLabel,
  filterCellDirectory,
  firstLeaderWithWhatsapp,
  foldText,
  formatDateKey,
  leaderNames,
  leadersTeaser,
  mapDirectoryRows,
  mapMemberCandidates,
  mapVisitRequestRows,
  validateVisitForm
} from '../app/utils/cellDirectory'

const row = {
  cell_id: 'c1',
  name: 'Célula Esperança',
  description: null,
  meeting_weekday: 4,
  meeting_time: '20:00:00',
  neighborhood: 'Jardim São João',
  city: 'São Paulo',
  region: 'SP',
  address_line: null,
  postal_code: null,
  full_address_visible: false,
  show_full_address: false,
  relationship: null,
  leaders: [
    { user_id: 'u1', full_name: 'Ana Souza', avatar_path: null, bio: 'Casada com o Bruno.\nAma louvor.', whatsapp: '5511999990000', instagram: 'ana' },
    { user_id: 'u2', full_name: 'Bruno Souza', avatar_path: 'u2/a.jpg', bio: null, whatsapp: null, instagram: null },
    { full_name: 'sem id' }
  ],
  my_visit_request: { id: 'r1', status: 'pending', created_at: '2026-09-28T10:00:00Z', preferred_date: null }
}

function entry(overrides: Partial<CellDirectoryEntry> = {}): CellDirectoryEntry {
  return { ...mapDirectoryRows([row])[0]!, ...overrides }
}

describe('schedule label', () => {
  it('uses plural weekdays and compact hours', () => {
    expect(cellShortScheduleLabel(4, '20:00:00')).toBe('Quintas, 20h')
    expect(cellShortScheduleLabel(3, '19:30')).toBe('Quartas, 19h30')
    expect(cellShortScheduleLabel(0)).toBe('Domingos')
    expect(cellShortScheduleLabel(undefined, '20:00')).toBe('Dia a definir, 20h')
    expect(cellShortScheduleLabel(null, null)).toBe('Dia a definir')
  })
})

describe('mapDirectoryRows', () => {
  it('maps valid rows and drops malformed leaders and rows', () => {
    const [mapped] = mapDirectoryRows([row, { name: 'sem id' }, 'lixo'])
    expect(mapDirectoryRows([row, { name: 'sem id' }, 'lixo'])).toHaveLength(1)
    expect(mapped).toMatchObject({ id: 'c1', meetingWeekday: 4, addressLine: undefined, fullAddressVisible: false, showFullAddress: false, relationship: null })
    expect(mapped?.leaders.map(leader => leader.userId)).toEqual(['u1', 'u2'])
    expect(mapped?.myVisitRequest).toMatchObject({ id: 'r1', status: 'pending' })
  })

  it('returns an empty list for unexpected payloads', () => {
    expect(mapDirectoryRows(null)).toEqual([])
    expect(mapDirectoryRows({})).toEqual([])
  })

  it('maps visit requests and member candidates defensively', () => {
    expect(mapVisitRequestRows([{ id: 'r', requester_id: 'u', requester_name: 'João', status: 'contacted', created_at: 'x' }, { id: 'bad', status: 'unknown' }]))
      .toEqual([expect.objectContaining({ id: 'r', requesterName: 'João', status: 'contacted', requesterPhone: undefined })])
    expect(mapMemberCandidates([{ id: 'u', full_name: 'Carla', avatar_path: null }, {}])).toEqual([{ id: 'u', name: 'Carla', avatarPath: undefined }])
  })
})

describe('directory filters', () => {
  const list = [entry(), entry({ id: 'c2', name: 'Célula Graça', meetingWeekday: 2, neighborhood: 'Centro', leaders: [] })]

  it('folds accents and case', () => {
    expect(foldText('  São JOÃO ')).toBe('sao joao')
  })

  it('filters by weekday and by name, neighborhood or leader', () => {
    expect(filterCellDirectory(list, { weekday: 2, search: '' }).map(item => item.id)).toEqual(['c2'])
    expect(filterCellDirectory(list, { weekday: null, search: 'sao joao' }).map(item => item.id)).toEqual(['c1'])
    expect(filterCellDirectory(list, { weekday: null, search: 'graca' }).map(item => item.id)).toEqual(['c2'])
    expect(filterCellDirectory(list, { weekday: null, search: 'bruno' }).map(item => item.id)).toEqual(['c1'])
    expect(filterCellDirectory(list, { weekday: 4, search: 'centro' })).toEqual([])
  })
})

describe('leaders summary', () => {
  it('joins first names in Portuguese', () => {
    const leaders = entry().leaders
    expect(leaderNames(leaders)).toBe('Ana e Bruno')
    expect(leaderNames([...leaders, { userId: 'u3', name: 'Carla Lima' }])).toBe('Ana, Bruno e Carla')
    expect(leaderNames([])).toBe('')
  })

  it('uses the first line of the first bio and truncates it', () => {
    expect(leadersTeaser(entry().leaders)).toBe('Casada com o Bruno.')
    expect(leadersTeaser([{ userId: 'x', name: 'X', bio: 'a'.repeat(200) }], 20)).toHaveLength(20)
    expect(leadersTeaser([])).toBe('')
  })

  it('finds the first leader reachable on WhatsApp', () => {
    expect(firstLeaderWithWhatsapp(entry().leaders)?.userId).toBe('u1')
    expect(firstLeaderWithWhatsapp([])).toBeUndefined()
  })
})

describe('visit requests', () => {
  it('allows a request only for outsiders without an open request', () => {
    expect(canRequestVisit(entry())).toBe(false)
    expect(canRequestVisit(entry({ myVisitRequest: undefined }))).toBe(true)
    expect(canRequestVisit(entry({ myVisitRequest: { id: 'r', status: 'closed', createdAt: '' } }))).toBe(true)
    expect(canRequestVisit(entry({ myVisitRequest: undefined, relationship: 'member' }))).toBe(false)
    expect(canRequestVisit(entry({ myVisitRequest: undefined, relationship: 'manager' }))).toBe(true)
  })

  it('validates the message length and the preferred date window', () => {
    const today = '2026-09-28'
    expect(validateVisitForm({ message: '', preferredDate: '', sharePhone: false }, today)).toEqual({})
    expect(validateVisitForm({ message: 'x'.repeat(501), preferredDate: '2026-09-27', sharePhone: false }, today)).toEqual({
      message: 'Use até 500 caracteres.',
      preferredDate: 'Escolha uma data a partir de hoje e em até 6 meses.'
    })
    expect(validateVisitForm({ message: '', preferredDate: addDays(today, 181), sharePhone: false }, today).preferredDate).toBeTruthy()
    expect(validateVisitForm({ message: '', preferredDate: addDays(today, 180), sharePhone: false }, today)).toEqual({})
  })

  it('adds days across month boundaries and formats dates', () => {
    expect(addDays('2026-09-28', 5)).toBe('2026-10-03')
    expect(formatDateKey('2026-10-03')).toBe('03/10/2026')
    expect(formatDateKey(undefined)).toBe('')
  })
})

describe('cellErrorMessage', () => {
  it('shows database messages written for people and hides technical ones', () => {
    expect(cellErrorMessage({ code: 'P0001', message: 'Você já participa desta célula.' }, 'x')).toBe('Você já participa desta célula.')
    expect(cellErrorMessage({ code: '42501', message: 'permission denied for table cells' }, 'Sem permissão.')).toBe('Sem permissão.')
    expect(cellErrorMessage(new Error('Informe pelo menos duas opções.'), 'x')).toBe('Informe pelo menos duas opções.')
    expect(cellErrorMessage('boom', 'Falhou.')).toBe('Falhou.')
  })
})
