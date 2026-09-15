export interface EditorialMessage {
  slug: string
  title: string
  eyebrow: string
  excerpt: string
  reference: string
  body: string[]
  author: string
  readTime: string
}

export interface ChurchEventCard {
  id: string
  title: string
  kind: 'Culto' | 'Encontro' | 'Ensaio' | 'Ação social'
  date: string
  time: string
  location: string
  description: string
}

export const dailyMessage: EditorialMessage = {
  slug: 'um-passo-de-cada-vez',
  title: 'Um passo de cada vez',
  eyebrow: 'Palavra do dia',
  excerpt: 'A fidelidade também é construída nas pequenas escolhas, quando seguimos com esperança mesmo sem enxergar o caminho inteiro.',
  reference: 'Salmos 119:105',
  body: [
    'Nem sempre recebemos o mapa completo. Muitas vezes, Deus ilumina apenas o trecho necessário para o próximo passo.',
    'Caminhar com fé não é ignorar as perguntas, mas escolher não ficar paralisado por elas. Hoje, concentre-se na atitude de amor, coragem ou reconciliação que já está ao seu alcance.',
    'Pequenos passos de obediência formam caminhos inteiros. Siga em frente com a certeza de que você não caminha sozinho.'
  ],
  author: 'Equipe pastoral CEDA',
  readTime: '3 min de leitura'
}

export const newsItems = [
  {
    slug: 'agenda-da-semana',
    category: 'Agenda',
    title: 'Confira os encontros desta semana',
    excerpt: 'Cultos, ensaios e atividades da comunidade reunidos em um só lugar para você se organizar.',
    date: 'Hoje',
    icon: 'i-lucide-calendar-check-2'
  },
  {
    slug: 'novos-grupos-de-comunhao',
    category: 'Comunidade',
    title: 'Novos grupos para caminhar junto',
    excerpt: 'Conheça os espaços de comunhão e descubra onde você pode participar e servir.',
    date: 'Esta semana',
    icon: 'i-lucide-users-round'
  },
  {
    slug: 'cuidado-que-se-multiplica',
    category: 'Ação social',
    title: 'Cuidado que se multiplica',
    excerpt: 'Veja como contribuir com as campanhas e iniciativas de apoio conduzidas pela comunidade.',
    date: 'Em destaque',
    icon: 'i-lucide-hand-heart'
  }
]

export const upcomingEvents: ChurchEventCard[] = [
  {
    id: 'culto-celebracao',
    title: 'Culto de celebração',
    kind: 'Culto',
    date: 'Domingo',
    time: '19h',
    location: 'Templo principal',
    description: 'Um tempo de louvor, palavra e comunhão para toda a família.'
  },
  {
    id: 'encontro-familias',
    title: 'Encontro de famílias',
    kind: 'Encontro',
    date: 'Quinta-feira',
    time: '20h',
    location: 'Sala multiuso',
    description: 'Conversa, cuidado e fortalecimento de vínculos em comunidade.'
  },
  {
    id: 'ensaio-musica',
    title: 'Ensaio de música',
    kind: 'Ensaio',
    date: 'Sábado',
    time: '16h',
    location: 'Auditório',
    description: 'Preparação das equipes de louvor e apoio técnico.'
  },
  {
    id: 'acao-solidaria',
    title: 'Ação solidária',
    kind: 'Ação social',
    date: 'Próximo sábado',
    time: '9h',
    location: 'Ponto de encontro na igreja',
    description: 'Organização e entrega das doações recebidas pela comunidade.'
  }
]

export const campaignCards = [
  {
    title: 'Cesta de cuidado',
    description: 'Arrecadação de alimentos e itens de higiene para famílias acompanhadas pela igreja.',
    progress: 68,
    raised: '68 itens recebidos',
    goal: 'Meta de 100 itens',
    icon: 'i-lucide-package-check',
    action: 'Ver itens prioritários'
  },
  {
    title: 'Estrutura para acolher',
    description: 'Melhorias nos espaços usados por crianças, famílias e equipes de cuidado.',
    progress: 35,
    raised: '35% concluído',
    goal: 'Atualização semanal',
    icon: 'i-lucide-house-plus',
    action: 'Conhecer a campanha'
  }
]

export const communityGroups = [
  { name: 'Famílias', visibility: 'Membros', detail: 'Encontros para fortalecer relacionamentos e compartilhar a caminhada.', icon: 'i-lucide-heart-handshake', members: 'Encontros quinzenais' },
  { name: 'Jovens', visibility: 'Membros', detail: 'Comunhão, conversa e serviço para quem está construindo novos caminhos.', icon: 'i-lucide-sparkles', members: 'Encontros semanais' },
  { name: 'Louvor', visibility: 'Com aprovação', detail: 'Espaço das equipes de música, produção e apoio aos cultos.', icon: 'i-lucide-music-2', members: 'Escalas e ensaios' },
  { name: 'Ação social', visibility: 'Membros', detail: 'Mobilização de voluntários para campanhas e iniciativas de cuidado.', icon: 'i-lucide-hand-heart', members: 'Ações mensais' }
]
