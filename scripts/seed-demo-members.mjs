// Semeia dados de DEMONSTRAÇÃO no Supabase do CEDA: ~100 membros organizados em
// famílias (casais, filhos, avós, tios), a família de cada um em family_members,
// as crianças de até 12 anos como Sementinhas (children + child_guardians), dois
// filhos para a conta de teste pais@pais.com e as salas por faixa etária
// (children_classes) com professor@professor.com como professor de todas.
//
// Tudo o que é criado fica marcado com app_metadata.seed / user_metadata.seed =
// 'ceda-demo-2026-09' para ser removido depois por scripts/cleanup-demo-members.mjs.
//
// Uso:
//   SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=<chave> \
//     node scripts/seed-demo-members.mjs            # grava no banco
//   node scripts/seed-demo-members.mjs --plan       # só mostra o plano, sem banco
//
// - Determinístico (PRNG com semente fixa) e idempotente: rodar de novo não
//   duplica nada; usuários são encontrados pelo e-mail, crianças pelo par
//   (nome, nascimento), salas pelo nome.
// - As senhas são aleatórias e nunca impressas: as contas não são para login.
// - A chave de serviço vem só de variável de ambiente; nunca a grave em arquivo.
import { randomBytes } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

export const SEED_TAG = 'ceda-demo-2026-09'
const REFERENCE_DATE = { year: 2026, month: 9, day: 28 }
const EMAIL_DOMAIN = 'ceda.test'
const PAIS_EMAIL = 'pais@pais.com'
const TEACHER_EMAIL = 'professor@professor.com'
const CREATE_DELAY_MS = 120
const CHUNK_SIZE = 200

export const PAIS_CHILDREN = [
  { full_name: 'Bento Teste', birth_date: '2022-05-14', allergies: null },
  { full_name: 'Lívia Teste', birth_date: '2018-02-03', allergies: 'Intolerância à lactose' }
]

export const DEMO_CLASSES = [
  { name: 'Berçário', min_age: 0, max_age: 1, room: 'Sala 1 — térreo', notes: 'Bebês de 0 a 1 ano. Traga fraldas, mamadeira e uma troca de roupa identificadas.' },
  { name: 'Maternal', min_age: 2, max_age: 3, room: 'Sala 2 — térreo', notes: 'Histórias bíblicas com música, massinha e brincadeiras.' },
  { name: 'Jardim', min_age: 4, max_age: 5, room: 'Sala 3 — térreo', notes: 'Primeiros versículos, pintura e atividades em grupo.' },
  { name: 'Primários', min_age: 6, max_age: 8, room: 'Sala 4 — 1º andar', notes: 'Estudo bíblico com leitura, jogos e memorização.' },
  { name: 'Juniores', min_age: 9, max_age: 10, room: 'Sala 5 — 1º andar', notes: 'Estudo bíblico, dinâmicas e projetos em equipe.' },
  { name: 'Pré-adolescentes', min_age: 11, max_age: 12, room: 'Sala 6 — 1º andar', notes: 'Conversas sobre fé e amizade, louvor e discipulado.' }
]

const ALLERGY_NOTES = [
  'Alergia a amendoim',
  'Intolerância à lactose',
  'Usa bombinha para asma (fica na mochila)',
  'Alergia a picada de abelha',
  'Doença celíaca: não pode comer glúten',
  'Alergia a corante vermelho'
]

const NAMES = {
  elder: {
    male: ['José', 'Antônio', 'Francisco', 'João', 'Sebastião', 'Raimundo', 'Manoel', 'Geraldo', 'Benedito', 'Luiz', 'Joaquim', 'Osvaldo', 'Valdir', 'Waldemar', 'Orlando', 'Aparecido', 'Jair', 'Nelson'],
    female: ['Maria', 'Terezinha', 'Aparecida', 'Conceição', 'Raimunda', 'Francisca', 'Antônia', 'Benedita', 'Iracema', 'Neusa', 'Marlene', 'Zilda', 'Lourdes', 'Nair', 'Dirce', 'Sônia', 'Vera Lúcia', 'Maria José', 'Maria das Graças', 'Cleusa']
  },
  adult: {
    male: ['Carlos Eduardo', 'Marcos', 'Rodrigo', 'Fábio', 'André', 'Luciano', 'Alexandre', 'Ricardo', 'Leandro', 'Márcio', 'Anderson', 'Fernando', 'Thiago', 'Rafael', 'Diego', 'Bruno', 'Gustavo', 'Daniel', 'Leonardo', 'Felipe', 'Vinícius', 'Juliano', 'Rogério', 'Sérgio', 'Cláudio', 'Wellington', 'Renato', 'Maurício', 'Paulo Henrique', 'José Carlos', 'Luiz Fernando', 'Everton'],
    female: ['Ana Paula', 'Fernanda', 'Juliana', 'Patrícia', 'Adriana', 'Luciana', 'Cristiane', 'Simone', 'Daniela', 'Aline', 'Camila', 'Priscila', 'Vanessa', 'Tatiane', 'Renata', 'Débora', 'Kátia', 'Elaine', 'Sabrina', 'Jaqueline', 'Mariana', 'Carla', 'Gabriela', 'Michele', 'Viviane', 'Andréia', 'Cláudia', 'Rosângela', 'Márcia', 'Eliane', 'Érica', 'Luana']
  },
  young: {
    male: ['Lucas', 'Gabriel', 'Matheus', 'Guilherme', 'Pedro Henrique', 'João Vitor', 'Enzo', 'Kauã', 'Samuel', 'Nicolas', 'Vitor Hugo', 'Caio', 'Igor', 'Luan', 'Eduardo', 'Otávio', 'Murilo', 'Breno'],
    female: ['Júlia', 'Beatriz', 'Larissa', 'Isabela', 'Giovanna', 'Maria Eduarda', 'Ana Clara', 'Letícia', 'Yasmin', 'Sofia', 'Lara', 'Emanuelly', 'Rebeca', 'Manuela', 'Bianca', 'Nicole', 'Vitória', 'Ana Júlia']
  },
  kid: {
    male: ['Miguel', 'Arthur', 'Heitor', 'Théo', 'Davi', 'Gael', 'Bernardo', 'Ravi', 'Noah', 'Benício', 'Joaquim', 'Lorenzo', 'Isaac', 'Anthony', 'Mateus', 'Benjamin', 'Henrique', 'Pietro', 'Emanuel', 'Lucca', 'Otto', 'Vicente', 'Levi', 'Enrico', 'Bryan', 'Cauê'],
    female: ['Helena', 'Alice', 'Laura', 'Cecília', 'Valentina', 'Aurora', 'Maria Clara', 'Heloísa', 'Maitê', 'Isadora', 'Antonella', 'Liz', 'Esther', 'Sophia', 'Elisa', 'Ana Luiza', 'Mirella', 'Luna', 'Lorena', 'Maria Alice', 'Olívia', 'Clara', 'Melissa', 'Agatha', 'Stella', 'Maria Luísa']
  }
}

const SURNAMES = ['Silva', 'Santos', 'Oliveira', 'Souza', 'Rodrigues', 'Ferreira', 'Alves', 'Pereira', 'Lima', 'Gomes', 'Costa', 'Ribeiro', 'Martins', 'Carvalho', 'Almeida', 'Lopes', 'Soares', 'Fernandes', 'Vieira', 'Barbosa', 'Rocha', 'Dias', 'Nascimento', 'Andrade', 'Moreira', 'Nunes', 'Marques', 'Machado', 'Mendes', 'Freitas', 'Cardoso', 'Ramos', 'Gonçalves', 'Santana', 'Teixeira', 'Araújo', 'Moura', 'Cavalcanti', 'Campos', 'Batista', 'Monteiro', 'Pinto', 'Correia', 'Farias', 'Rezende', 'Peixoto', 'Brandão', 'Siqueira', 'Queiroz', 'Macedo', 'Figueiredo', 'Barros', 'Castro', 'Azevedo', 'Prado', 'Tavares', 'Assunção', 'Magalhães', 'Guimarães', 'Conceição']

const HOUSEHOLD_PLAN = [
  ...Array(12).fill('nuclear'),
  ...Array(6).fill('grandparents'),
  ...Array(3).fill('widowedGrandparent'),
  ...Array(4).fill('uncle'),
  ...Array(3).fill('singleParent'),
  ...Array(4).fill('olderCouple')
]
const SINGLES_PLAN = [...Array(6).fill('youngSingle'), ...Array(5).fill('widowElder'), ...Array(4).fill('singleAdult')]
const KIDS_PER_AGE = 4
const MAX_SEMENTINHA_AGE = 12

// PRNG e datas ----------------------------------------------------------------

function createRng(seed) {
  let state = seed >>> 0
  const next = () => {
    state = (state + 0x6D2B79F5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const int = (min, max) => min + Math.floor(next() * (max - min + 1))
  const pick = list => list[Math.floor(next() * list.length)]
  const chance = probability => next() < probability
  const shuffle = (list) => {
    const copy = [...list]
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(next() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]]
    }
    return copy
  }
  return { next, int, pick, chance, shuffle }
}

const pad = value => String(value).padStart(2, '0')
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
const NEWBORN_SAFE_MONTHS = [10, 11, 12, 1, 2, 3, 4, 5, 6, 7]

export function birthDateFor(age, month, day, ref = REFERENCE_DATE) {
  const hadBirthday = month < ref.month || (month === ref.month && day <= ref.day)
  const year = ref.year - age - (hadBirthday ? 0 : 1)
  return `${year}-${pad(month)}-${pad(day)}`
}

export function ageOn(birthIso, todayIso) {
  const [by, bm, bd] = birthIso.split('-').map(Number)
  const [ty, tm, td] = todayIso.split('-').map(Number)
  return ty - by - (tm < bm || (tm === bm && td < bd) ? 1 : 0)
}

function saoPauloToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
}

const stripAccents = text => text.normalize('NFD').replace(/[̀-ͯ]/g, '')

// Geração das famílias ------------------------------------------------------

function generationOf(age) {
  const birthYear = REFERENCE_DATE.year - age
  if (birthYear <= 1965) return 'elder'
  if (birthYear <= 1999) return 'adult'
  if (birthYear <= 2013) return 'young'
  return 'kid'
}

function createPlanner(rng) {
  const usedNames = new Set()
  const usedGiven = new Set()
  const usedGivenByHousehold = new Map()
  let personCount = 0
  const surnamePool = rng.shuffle(SURNAMES)
  let surnameIndex = 0
  const takeSurname = () => surnamePool[surnameIndex++ % surnamePool.length]

  const person = ({ household, role, side = null, sex, age, lastNames, profile, guardian = false }) => {
    const pool = NAMES[generationOf(age)][sex]
    // Prefere nomes ainda não usados (variedade) e nunca repete nome completo nem
    // o primeiro nome dentro da mesma casa.
    const householdGiven = usedGivenByHousehold.get(household) ?? new Set()
    let fullName = ''
    let given = ''
    for (let attempt = 0; attempt < 60; attempt++) {
      given = rng.pick(pool)
      fullName = [given, ...lastNames].join(' ')
      const fresh = attempt >= 30 || !usedGiven.has(given)
      if (fresh && !usedNames.has(fullName) && !householdGiven.has(given)) break
    }
    usedNames.add(fullName)
    usedGiven.add(given)
    usedGivenByHousehold.set(household, new Set([...householdGiven, given]))
    // Bebês de 0 ano nascem entre 10/2025 e 07/2026 (pelo menos 2 meses de vida).
    const month = age === 0 ? rng.pick(NEWBORN_SAFE_MONTHS) : rng.int(1, 12)
    const day = rng.int(1, DAYS_IN_MONTH[month - 1])
    personCount++
    return { key: `${household}:${role}:${personCount}`, household, role, side, sex, age, month, day, fullName, profile, guardian }
  }

  return { rng, takeSurname, person }
}

function otherSurname(rng, excluded) {
  return rng.pick(SURNAMES.filter(name => !excluded.includes(name)))
}

function allocateYoungKids(rng, households) {
  let pool = rng.shuffle(Array.from({ length: (MAX_SEMENTINHA_AGE + 1) * KIDS_PER_AGE }, (_, i) => i % (MAX_SEMENTINHA_AGE + 1)))
  const eligible = households.map((kind, index) => ({ kind, index })).filter(h => h.kind !== 'olderCouple')
  const ages = new Map(eligible.map(h => [h.index, []]))
  for (let round = 0; round < 12 && pool.length; round++) {
    for (const h of eligible) {
      const current = ages.get(h.index)
      const limit = h.kind === 'singleParent' ? 2 : 3
      if (!pool.length || current.length >= limit || (current.length > 0 && rng.chance(0.45))) continue
      const index = pool.findIndex(age => current.every(other => Math.abs(other - age) >= 2))
      if (index === -1) continue
      ages.set(h.index, [...current, pool[index]])
      pool = pool.filter((_, i) => i !== index)
    }
  }
  return { ages, unplaced: pool }
}

function parentAgeFor(rng, childAges) {
  const oldest = Math.max(...childAges)
  const youngest = Math.min(...childAges)
  const low = Math.max(oldest + 21, youngest + 22)
  const high = Math.max(low, Math.min(youngest + 40, low + 10))
  return rng.int(low, high)
}

function buildHousehold(planner, kind, index, youngAges) {
  const { rng, takeSurname, person } = planner
  const id = `f${pad(index + 1)}`
  const hLast = takeSurname()
  const wLast = takeSurname()
  const hMid = otherSurname(rng, [hLast, wLast])
  const wMid = otherSurname(rng, [hLast, wLast, hMid])
  const members = []
  const hasHusband = kind !== 'singleParent'
  const addTeen = ['nuclear', 'grandparents', 'olderCouple'].includes(kind) && rng.chance(kind === 'olderCouple' ? 0.6 : 0.35)
  const maxYoung = youngAges.length ? Math.max(...youngAges) : 0
  const teenAge = addTeen && maxYoung + 2 <= 17 ? rng.int(Math.max(13, maxYoung + 2), 17) : null
  const adultKidAges = kind === 'olderCouple' ? [rng.int(19, 27), ...(rng.chance(0.5) ? [rng.int(18, 30)] : [])] : []
  const childAges = [...youngAges, ...(teenAge === null ? [] : [teenAge]), ...adultKidAges]
    .sort((a, b) => b - a)
    .filter((age, i, list) => i === 0 || list[i - 1] - age >= 2)

  const wifeAge = !childAges.length ? rng.int(28, 40) : kind === 'olderCouple' ? Math.max(...childAges) + rng.int(22, 31) : parentAgeFor(rng, childAges)
  const husbandAge = Math.max(21, wifeAge + rng.int(-2, 6))
  const wifeTakesName = hasHusband && rng.chance(0.7)
  const wifeLastNames = wifeTakesName ? [wLast, hLast] : [wMid, wLast]
  const kidLastNames = hasHusband ? (rng.chance(0.6) ? [wLast, hLast] : [hLast]) : [wLast, otherSurname(rng, [wLast, wMid])]

  if (hasHusband) {
    members.push(person({ household: id, role: 'H', sex: 'male', age: husbandAge, lastNames: rng.chance(0.4) ? [hMid, hLast] : [hLast], profile: true }))
  }
  members.push(person({ household: id, role: 'W', sex: 'female', age: wifeAge, lastNames: wifeLastNames, profile: true }))

  for (const age of childAges) {
    const sex = rng.chance(0.5) ? 'male' : 'female'
    const profile = age >= 18 || (age >= 13 && rng.chance(0.65))
    members.push(person({ household: id, role: 'C', sex, age, lastNames: kidLastNames, profile }))
  }

  const wantsGrandparents = kind === 'grandparents' || kind === 'widowedGrandparent' || (kind === 'singleParent' && index % 3 === 0)
  if (wantsGrandparents) {
    const side = hasHusband && rng.chance(0.5) ? 'H' : 'W'
    const sideAge = side === 'H' ? husbandAge : wifeAge
    const sideLast = side === 'H' ? hLast : wLast
    const sideMid = side === 'H' ? hMid : wMid
    const grandmotherAge = Math.min(85, sideAge + rng.int(23, 31))
    const grandfatherAge = Math.min(85, grandmotherAge + rng.int(0, 5))
    const widowed = kind === 'widowedGrandparent' || kind === 'singleParent'
    const onlyGrandfather = widowed && rng.chance(0.3)
    const guardian = kind === 'singleParent' || (kind === 'grandparents' && index % 2 === 0)
    if (!widowed || onlyGrandfather) {
      members.push(person({ household: id, role: 'GP', side, sex: 'male', age: grandfatherAge, lastNames: [sideLast], profile: true, guardian: guardian && onlyGrandfather }))
    }
    if (!onlyGrandfather) {
      members.push(person({ household: id, role: 'GP', side, sex: 'female', age: grandmotherAge, lastNames: [sideMid, sideLast], profile: true, guardian }))
    }
  }

  if (kind === 'uncle') {
    const side = rng.chance(0.5) ? 'H' : 'W'
    const sideAge = side === 'H' ? husbandAge : wifeAge
    const lastNames = side === 'H' ? [hLast] : [wMid, wLast]
    members.push(person({ household: id, role: 'SIB', side, sex: rng.chance(0.5) ? 'male' : 'female', age: Math.max(19, sideAge + rng.int(-9, 8)), lastNames, profile: true }))
  }

  return { id, kind, members, externals: [] }
}

function buildSingle(planner, kind, index) {
  const { rng, takeSurname, person } = planner
  const id = `s${pad(index + 1)}`
  const last = takeSurname()
  const mid = otherSurname(rng, [last])
  const sex = kind === 'widowElder' ? (rng.chance(0.7) ? 'female' : 'male') : (rng.chance(0.5) ? 'male' : 'female')
  const age = { youngSingle: rng.int(18, 30), widowElder: rng.int(70, 85), singleAdult: rng.int(32, 56) }[kind]
  const owner = person({ household: id, role: 'SELF', sex, age, lastNames: [mid, last], profile: true })
  const relative = (relationship, relSex, relAge, lastNames) => ({
    ...person({ household: id, role: 'EXT', sex: relSex, age: relAge, lastNames, profile: false }),
    relationship
  })
  const externals = []
  if (kind === 'youngSingle') {
    const motherAge = age + rng.int(22, 32)
    externals.push(relative('Mãe', 'female', motherAge, [mid, last]))
    if (rng.chance(0.7)) externals.push(relative('Pai', 'male', motherAge + rng.int(0, 5), [last]))
    if (rng.chance(0.6)) {
      const siblingSex = rng.chance(0.5) ? 'male' : 'female'
      externals.push(relative(siblingSex === 'male' ? 'Irmão' : 'Irmã', siblingSex, Math.max(13, age + rng.int(-6, 6)), [mid, last]))
    }
  } else if (kind === 'widowElder') {
    const kids = rng.int(1, 3)
    for (let i = 0; i < kids; i++) {
      const kidSex = rng.chance(0.5) ? 'male' : 'female'
      const kidAge = age - rng.int(24, 36)
      externals.push(relative(kidSex === 'male' ? 'Filho' : 'Filha', kidSex, kidAge, [last]))
      if (kidAge >= 40 && rng.chance(0.7)) {
        const grandSex = rng.chance(0.5) ? 'male' : 'female'
        externals.push(relative(grandSex === 'male' ? 'Neto' : 'Neta', grandSex, Math.max(13, kidAge - rng.int(22, 30)), [otherSurname(rng, [last, mid]), last]))
      }
    }
  } else {
    externals.push(relative('Mãe', 'female', Math.min(88, age + rng.int(22, 30)), [mid, last]))
    const siblingSex = rng.chance(0.5) ? 'male' : 'female'
    const siblingAge = Math.max(18, age + rng.int(-7, 7))
    externals.push(relative(siblingSex === 'male' ? 'Irmão' : 'Irmã', siblingSex, siblingAge, [mid, last]))
    if (siblingAge >= 33 && rng.chance(0.6)) {
      const nephewSex = rng.chance(0.5) ? 'male' : 'female'
      externals.push(relative(nephewSex === 'male' ? 'Sobrinho' : 'Sobrinha', nephewSex, Math.max(13, siblingAge - rng.int(22, 30)), [otherSurname(rng, [last, mid]), last]))
    }
  }
  return { id, kind, members: [owner], externals }
}

// Parentesco do ponto de vista de "owner" para "target" na mesma casa.
export function relationshipOf(owner, target) {
  const gendered = (male, female) => (target.sex === 'male' ? male : female)
  const o = owner.role
  const t = target.role
  const couple = ['H', 'W']
  if (couple.includes(o) && couple.includes(t)) return gendered('Marido', 'Esposa')
  if (couple.includes(o) && t === 'C') return gendered('Filho', 'Filha')
  if (o === 'C' && couple.includes(t)) return gendered('Pai', 'Mãe')
  if (o === 'C' && t === 'C') return gendered('Irmão', 'Irmã')
  if (o === 'C' && t === 'GP') return gendered('Avô', 'Avó')
  if (o === 'GP' && t === 'C') return gendered('Neto', 'Neta')
  if (couple.includes(o) && t === 'GP') return target.side === o ? gendered('Pai', 'Mãe') : gendered('Sogro', 'Sogra')
  if (o === 'GP' && couple.includes(t)) return t === owner.side ? gendered('Filho', 'Filha') : gendered('Genro', 'Nora')
  if (o === 'GP' && t === 'GP') return gendered('Marido', 'Esposa')
  if (o === 'GP' && t === 'SIB') return target.side === owner.side ? gendered('Filho', 'Filha') : null
  if (o === 'SIB' && t === 'GP') return target.side === owner.side ? gendered('Pai', 'Mãe') : null
  if (couple.includes(o) && t === 'SIB') return target.side === o ? gendered('Irmão', 'Irmã') : gendered('Cunhado', 'Cunhada')
  if (o === 'SIB' && couple.includes(t)) return owner.side === t ? gendered('Irmão', 'Irmã') : gendered('Cunhado', 'Cunhada')
  if (o === 'SIB' && t === 'C') return gendered('Sobrinho', 'Sobrinha')
  if (o === 'C' && t === 'SIB') return gendered('Tio', 'Tia')
  return null
}

function assignBirthdays(rng, people) {
  const weekDates = [[9, 28], [9, 28], [9, 29], [9, 30], [10, 1], [10, 2], [10, 4]]
  const candidates = rng.shuffle(people.filter(p => p.profile && p.age >= 13).map(p => p.key))
  const overrides = new Map()
  candidates.slice(0, weekDates.length).forEach((key, i) => overrides.set(key, { month: weekDates[i][0], day: weekDates[i][1], optIn: true }))
  candidates.slice(weekDates.length, weekDates.length + 9).forEach(key => overrides.set(key, { month: 9, day: rng.int(1, 27), optIn: true }))
  return people.map((p) => {
    const override = overrides.get(p.key)
    const month = override?.month ?? p.month
    const day = override?.day ?? p.day
    const optIn = p.profile ? (override?.optIn ?? rng.chance(0.55)) : false
    return { ...p, month, day, optIn, birthDate: birthDateFor(p.age, month, day) }
  })
}

function assignEmails(people) {
  const used = new Map()
  return people.map((p) => {
    if (!p.profile) return p
    const tokens = p.fullName.split(' ')
    const base = stripAccents(`${tokens[0]}.${tokens[tokens.length - 1]}`).toLowerCase().replace(/[^a-z.]/g, '')
    const count = (used.get(base) ?? 0) + 1
    used.set(base, count)
    return { ...p, email: `${base}${count > 1 ? count : ''}@${EMAIL_DOMAIN}` }
  })
}

export function buildPlan() {
  const rng = createRng(20260928)
  const planner = createPlanner(rng)
  const { ages, unplaced } = allocateYoungKids(rng, HOUSEHOLD_PLAN)
  const rawHouseholds = [
    ...HOUSEHOLD_PLAN.map((kind, i) => buildHousehold(planner, kind, i, ages.get(i) ?? [])),
    ...SINGLES_PLAN.map((kind, i) => buildSingle(planner, kind, i))
  ]
  const everyone = assignEmails(assignBirthdays(rng, rawHouseholds.flatMap(h => [...h.members, ...h.externals])))
  const byKey = new Map(everyone.map(p => [p.key, p]))
  const households = rawHouseholds.map(h => ({
    ...h,
    members: h.members.map(p => byKey.get(p.key)),
    externals: h.externals.map(p => byKey.get(p.key))
  }))

  const profiles = everyone.filter(p => p.profile)
  const familyRows = households.flatMap(h => h.members.filter(p => p.profile).flatMap(owner => [
    ...h.members.filter(t => t.key !== owner.key).map(t => ({ ownerKey: owner.key, full_name: t.fullName, relationship: relationshipOf(owner, t), birth_date: t.birthDate })),
    ...h.externals.map(t => ({ ownerKey: owner.key, full_name: t.fullName, relationship: t.relationship, birth_date: t.birthDate }))
  ]).filter(row => row.relationship))

  const allergyRng = createRng(7)
  const allChildren = households.flatMap(h => h.members
    .filter(p => p.role === 'C' && p.age <= MAX_SEMENTINHA_AGE)
    .map((child) => {
      const parents = h.members.filter(p => p.role === 'H' || p.role === 'W')
      const guardians = [...parents, ...h.members.filter(p => p.role === 'GP' && p.guardian)]
      const creator = parents.find(p => p.role === 'W') ?? parents[0]
      return { key: child.key, household: h.id, full_name: child.fullName, birth_date: child.birthDate, age: child.age, creatorKey: creator.key, guardianKeys: guardians.map(g => g.key) }
    }))
  const allergyKeys = new Set(allergyRng.shuffle(allChildren.map(c => c.key)).slice(0, ALLERGY_NOTES.length))
  let allergyIndex = 0
  const children = allChildren.map(c => ({ ...c, allergies: allergyKeys.has(c.key) ? ALLERGY_NOTES[allergyIndex++] : null }))

  return { households, profiles, familyRows, children, unplaced }
}

function printPlan(plan) {
  const ageCounts = plan.children.reduce((acc, c) => ({ ...acc, [c.age]: (acc[c.age] ?? 0) + 1 }), {})
  console.log(`Perfis: ${plan.profiles.length} | casas: ${plan.households.filter(h => h.id.startsWith('f')).length} + ${plan.households.filter(h => h.id.startsWith('s')).length} sozinhos`)
  console.log(`Sementinhas: ${plan.children.length} | por idade: ${JSON.stringify(ageCounts)} | não alocadas: ${plan.unplaced.length}`)
  console.log(`family_members: ${plan.familyRows.length} | aniversários com consentimento: ${plan.profiles.filter(p => p.optIn).length}`)
  for (const h of plan.households.slice(0, 3)) {
    console.log(`\n[${h.id} ${h.kind}]`)
    for (const p of h.members) console.log(`  ${p.role}${p.side ? `(${p.side})` : ''} ${p.fullName} · ${p.birthDate} · ${p.age} anos${p.email ? ` · ${p.email}` : ''}`)
  }
}

function validatePlan(plan) {
  const problems = []
  const emails = plan.profiles.map(p => p.email)
  if (new Set(emails).size !== emails.length) problems.push('e-mails duplicados')
  if (plan.profiles.length < 100) problems.push(`apenas ${plan.profiles.length} perfis`)
  for (const p of plan.profiles) if (p.age < 13 || p.age > 85) problems.push(`idade fora da faixa: ${p.fullName}`)
  for (const row of plan.familyRows) if (row.relationship.length < 2 || row.relationship.length > 60) problems.push(`parentesco inválido: ${row.relationship}`)
  for (const c of plan.children) if (ageOn(c.birth_date, '2026-09-28') !== c.age) problems.push(`idade inconsistente: ${c.full_name}`)
  return problems
}

// Banco -------------------------------------------------------------------

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

async function withRetry(label, fn, attempts = 4) {
  for (let attempt = 1; ; attempt++) {
    const result = await fn()
    const status = result?.error?.status ?? result?.status ?? 0
    const retriable = result?.error && (status === 429 || status >= 500 || status === 0)
    if (!retriable || attempt >= attempts) return result
    console.warn(`  ${label}: tentativa ${attempt} falhou (${result.error.message}); repetindo…`)
    await sleep(500 * 2 ** attempt)
  }
}

const chunk = (list, size = CHUNK_SIZE) => Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, (i + 1) * size))

async function listAllUsers(db) {
  const users = []
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await withRetry('listUsers', () => db.auth.admin.listUsers({ page, perPage: 1000 }))
    if (error) throw error
    users.push(...data.users)
    if (data.users.length < 1000) return users
  }
  return users
}

async function ensureAuthUser(db, existing, profile) {
  const user_metadata = { ...(existing?.user_metadata ?? {}), full_name: profile.fullName, seed: SEED_TAG }
  const roles = [...new Set([...(existing?.app_metadata?.roles ?? []), 'member'])]
  const app_metadata = { ...(existing?.app_metadata ?? {}), roles, seed: SEED_TAG }
  if (existing) {
    if (existing.app_metadata?.seed !== SEED_TAG) throw new Error('e-mail já pertence a uma conta que não é de demonstração')
    const { error } = await withRetry(profile.email, () => db.auth.admin.updateUserById(existing.id, { user_metadata, app_metadata }))
    if (error) throw error
    return { id: existing.id, created: false }
  }
  const password = `${randomBytes(18).toString('base64url')}#A9`
  const { data, error } = await withRetry(profile.email, () => db.auth.admin.createUser({ email: profile.email, password, email_confirm: true, user_metadata, app_metadata }))
  if (error) throw error
  return { id: data.user.id, created: true }
}

async function must(label, promise) {
  const { data, error } = await promise
  if (error) throw new Error(`${label}: ${error.message}`)
  return data
}

async function seedUsers(db, plan, failures) {
  const users = await listAllUsers(db)
  const byEmail = new Map(users.map(u => [u.email?.toLowerCase(), u]))
  const ids = new Map()
  let created = 0
  for (const profile of plan.profiles) {
    try {
      const result = await ensureAuthUser(db, byEmail.get(profile.email), profile)
      ids.set(profile.key, result.id)
      if (result.created) {
        created++
        await sleep(CREATE_DELAY_MS)
      }
    } catch (error) {
      failures.push(`usuário ${profile.email}: ${error.message}`)
    }
  }
  const seeded = plan.profiles.filter(p => ids.has(p.key))
  for (const part of chunk(seeded, 50)) {
    const rows = part.map(p => ({ id: ids.get(p.key), full_name: p.fullName, email: p.email, sex: p.sex, birth_date: p.birthDate, birthday_greetings_opt_in: p.optIn, phone: null, avatar_path: null }))
    const { error } = await withRetry('profiles', () => db.from('profiles').upsert(rows, { onConflict: 'id' }))
    if (error) failures.push(`perfis (lote): ${error.message}`)
    const roleRows = part.map(p => ({ user_id: ids.get(p.key), role: 'member' }))
    const { error: roleError } = await withRetry('roles', () => db.from('user_system_roles').upsert(roleRows, { onConflict: 'user_id,role', ignoreDuplicates: true }))
    if (roleError) failures.push(`papéis (lote): ${roleError.message}`)
  }
  return { ids, created, users }
}

async function seedFamilyMembers(db, plan, ids, failures) {
  const ownerIds = [...ids.values()]
  for (const part of chunk(ownerIds, 100)) {
    const { error } = await db.from('family_members').delete().in('owner_id', part)
    if (error) failures.push(`limpar family_members: ${error.message}`)
  }
  const rows = plan.familyRows.filter(r => ids.has(r.ownerKey)).map(r => ({ owner_id: ids.get(r.ownerKey), full_name: r.full_name, relationship: r.relationship, birth_date: r.birth_date }))
  let inserted = 0
  for (const part of chunk(rows)) {
    const { error } = await withRetry('family_members', () => db.from('family_members').insert(part))
    if (error) failures.push(`family_members (lote): ${error.message}`)
    else inserted += part.length
  }
  return inserted
}

async function seedClasses(db, teacherId) {
  const existing = await must('ler salas', db.from('children_classes').select('id, name').is('archived_at', null))
  const classes = []
  for (const spec of DEMO_CLASSES) {
    const found = existing.find(c => c.name.toLowerCase() === spec.name.toLowerCase())
    const row = found
      ? await must(`sala ${spec.name}`, db.from('children_classes').update(spec).eq('id', found.id).select('id, name, min_age, max_age').single())
      : await must(`sala ${spec.name}`, db.from('children_classes').insert({ ...spec, created_by: teacherId }).select('id, name, min_age, max_age').single())
    await must(`professor ${spec.name}`, db.from('children_class_teachers').upsert({ class_id: row.id, teacher_id: teacherId, added_by: teacherId }, { onConflict: 'class_id,teacher_id', ignoreDuplicates: true }))
    classes.push(row)
  }
  return classes
}

async function upsertChild(db, existing, spec, creatorId, guardianIds) {
  const found = existing.find(c => c.created_by === creatorId && c.full_name === spec.full_name && c.birth_date === spec.birth_date)
  const child = found
    ? await must(`criança ${spec.full_name}`, db.from('children').update({ allergies: spec.allergies }).eq('id', found.id).select('id, birth_date').single())
    : await must(`criança ${spec.full_name}`, db.from('children').insert({ full_name: spec.full_name, birth_date: spec.birth_date, allergies: spec.allergies, created_by: creatorId }).select('id, birth_date').single())
  const links = guardianIds.map(guardian_id => ({ child_id: child.id, guardian_id, granted_by: creatorId }))
  await must(`responsáveis ${spec.full_name}`, db.from('child_guardians').upsert(links, { onConflict: 'child_id,guardian_id', ignoreDuplicates: true }))
  return child
}

async function seedChildren(db, plan, ids, paisId, failures) {
  const creatorIds = [...new Set([...plan.children.map(c => ids.get(c.creatorKey)).filter(Boolean), paisId])]
  const existing = []
  for (const part of chunk(creatorIds, 100)) existing.push(...await must('ler crianças', db.from('children').select('id, full_name, birth_date, created_by').in('created_by', part)))
  const seeded = []
  const specs = [
    ...plan.children.map(c => ({ ...c, creatorId: ids.get(c.creatorKey), guardianIds: c.guardianKeys.map(k => ids.get(k)).filter(Boolean) })),
    ...PAIS_CHILDREN.map(c => ({ ...c, creatorId: paisId, guardianIds: [paisId] }))
  ]
  for (const spec of specs) {
    if (!spec.creatorId) {
      failures.push(`criança ${spec.full_name}: responsável não foi criado`)
      continue
    }
    try {
      seeded.push({ ...spec, ...(await upsertChild(db, existing, spec, spec.creatorId, spec.guardianIds)) })
    } catch (error) {
      failures.push(error.message)
    }
  }
  return seeded
}

async function seedEnrollments(db, classes, children, teacherId, failures) {
  const today = saoPauloToday()
  const classIds = classes.map(c => c.id)
  const counts = Object.fromEntries(classes.map(c => [c.name, 0]))
  for (const child of children) {
    const age = ageOn(child.birth_date, today)
    const target = classes.find(c => age >= c.min_age && age <= c.max_age)
    if (!target) {
      failures.push(`matrícula ${child.full_name}: nenhuma sala para ${age} anos`)
      continue
    }
    const stale = classIds.filter(id => id !== target.id)
    const { error: deleteError } = await db.from('children_class_enrollments').delete().eq('child_id', child.id).in('class_id', stale)
    const { error } = await db.from('children_class_enrollments').upsert({ class_id: target.id, child_id: child.id, added_by: teacherId }, { onConflict: 'class_id,child_id', ignoreDuplicates: true })
    if (deleteError || error) failures.push(`matrícula ${child.full_name}: ${(deleteError ?? error).message}`)
    else counts[target.name]++
  }
  return counts
}

async function main() {
  const plan = buildPlan()
  const problems = validatePlan(plan)
  printPlan(plan)
  if (problems.length) {
    console.error('\nPlano inválido:\n', problems.join('\n'))
    process.exit(1)
  }
  if (process.argv.includes('--plan')) return

  const url = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    console.error('Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.')
    process.exit(1)
  }
  const db = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
  const failures = []

  console.log('\nContas e perfis…')
  const { ids, created, users } = await seedUsers(db, plan, failures)
  const findId = email => users.find(u => u.email?.toLowerCase() === email)?.id
  const paisId = findId(PAIS_EMAIL)
  const teacherId = findId(TEACHER_EMAIL)
  if (!paisId || !teacherId) throw new Error('Contas pais@pais.com e professor@professor.com precisam existir.')

  console.log('Família (family_members)…')
  const familyCount = await seedFamilyMembers(db, plan, ids, failures)
  console.log('Salas…')
  const classes = await seedClasses(db, teacherId)
  console.log('Sementinhas…')
  const children = await seedChildren(db, plan, ids, paisId, failures)
  console.log('Matrículas…')
  const enrollments = await seedEnrollments(db, classes, children, teacherId, failures)

  console.log(`\nContas: ${ids.size}/${plan.profiles.length} (${created} novas) | family_members: ${familyCount} | crianças: ${children.length}`)
  console.table(enrollments)
  if (failures.length) {
    console.log(`\n${failures.length} falha(s):`)
    for (const failure of failures) console.log(`  - ${failure}`)
    process.exitCode = 1
  }
}

if (process.argv[1]?.endsWith('seed-demo-members.mjs')) {
  main().catch((error) => {
    console.error('Falha geral:', error.message)
    process.exit(1)
  })
}
