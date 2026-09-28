import type { CellDirectoryEntry, CellLeaderProfile } from '~/types/cells'
import type { CellDetail, CellSummary } from '~/types/domain'

// Conteúdo fictício exibido somente quando o app roda sem Supabase configurado.

const DEMO_LEADERS: CellLeaderProfile[] = [
  { userId: 'demo-leader', name: 'Ana Demonstração', bio: 'Casada com o Bruno, mãe da Lia. Ama receber pessoas em casa com um bom café.', whatsapp: '5511999990000', instagram: 'ceda.demo' },
  { userId: 'demo-coleader', name: 'Bruno Demonstração', bio: 'Músico e apaixonado por discipulado.' }
]

export const DEMO_DIRECTORY: CellDirectoryEntry[] = [
  {
    id: 'demo-lider',
    name: 'Célula Esperança',
    description: 'Demonstração do espaço de gestão de líderes.',
    meetingWeekday: 3,
    meetingTime: '20:00',
    neighborhood: 'Jardim Demonstração',
    city: 'São Paulo',
    region: 'SP',
    addressLine: 'Rua de demonstração, 123',
    postalCode: '00000-000',
    fullAddressVisible: true,
    showFullAddress: true,
    relationship: 'leader',
    leaders: DEMO_LEADERS
  },
  {
    id: 'demo-aberta',
    name: 'Célula Amizade',
    description: 'Célula fictícia aberta a visitantes.',
    meetingWeekday: 4,
    meetingTime: '19:30',
    neighborhood: 'Vila Exemplo',
    city: 'São Paulo',
    region: 'SP',
    fullAddressVisible: false,
    showFullAddress: false,
    relationship: null,
    leaders: [{ userId: 'demo-other', name: 'Carla Exemplo', bio: 'Líder de jovens, adora trilhas.', whatsapp: '5511988887777', instagram: 'carla.exemplo' }]
  }
]

export function demoCellDetail(summary: CellSummary): CellDetail {
  const managing = summary.access === 'leader'
  const invited = summary.access === 'invited'
  const now = new Date().toISOString()
  return {
    ...summary,
    showFullAddress: true,
    leaders: DEMO_LEADERS,
    address: invited
      ? undefined
      : { addressLine: 'Rua de demonstração, 123', neighborhood: 'Jardim Demonstração', city: 'São Paulo', region: 'SP', postalCode: '00000-000' },
    members: managing
      ? [
          { userId: 'demo-leader', name: 'Ana Demonstração', email: 'lider@demo.local', isLeader: true },
          { userId: 'demo-member', name: 'Membro de demonstração', email: 'membro@demo.local', isLeader: false }
        ]
      : [],
    invitations: invited ? [{ id: 'demo-invitation', cellId: summary.id, email: 'voce@demo.local', status: 'pending', createdAt: now }] : [],
    announcements: invited ? [] : [{ id: 'demo-announcement', cellId: summary.id, title: 'Encontro desta semana', body: 'Comunicado interno de demonstração para os membros da célula.', status: 'published', createdAt: now }],
    polls: invited
      ? []
      : [{
          id: 'demo-poll',
          cellId: summary.id,
          question: 'Qual o melhor horário para o próximo encontro?',
          status: 'published',
          createdAt: now,
          options: [
            { id: 'demo-option-a', label: '19h30', position: 0, votes: managing ? 2 : 0 },
            { id: 'demo-option-b', label: '20h', position: 1, votes: managing ? 1 : 0 }
          ]
        }]
  }
}
