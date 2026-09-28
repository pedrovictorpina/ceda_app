// Remove os dados de DEMONSTRAÇÃO criados por scripts/seed-demo-members.mjs
// (marca 'ceda-demo-2026-09'):
//   - contas de autenticação e perfis marcados (e, em cascata, papéis e family_members);
//   - crianças cadastradas por esses perfis e os dois filhos de demonstração de
//     pais@pais.com, com vínculos de responsáveis, matrículas e check-ins;
//   - as salas de demonstração criadas para professor@professor.com.
// Nunca remove contas sem a marca nem as 8 contas de teste (admin@admin.com etc.).
// Uma sala que tenha crianças de fora da demonstração é mantida (e avisada).
//
// Uso:
//   SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=<chave> \
//     node scripts/cleanup-demo-members.mjs           # simulação: só conta o que seria removido
//   ... node scripts/cleanup-demo-members.mjs --apply # remove de verdade
//
// A chave de serviço vem só de variável de ambiente; nunca a grave em arquivo.
import { createClient } from '@supabase/supabase-js'
import { DEMO_CLASSES, PAIS_CHILDREN, SEED_TAG } from './seed-demo-members.mjs'

const PROTECTED_EMAILS = ['admin@admin.com', 'pastor@pastor.com', 'membro@membro.com', 'pais@pais.com', 'professor@professor.com', 'caixa@caixa.com', 'balcao@balcao.com', 'lider@lider.com']
const SEED_EMAIL_SUFFIX = '@ceda.test'
const CHUNK = 100
const apply = process.argv.includes('--apply')

const chunk = list => Array.from({ length: Math.ceil(list.length / CHUNK) }, (_, i) => list.slice(i * CHUNK, (i + 1) * CHUNK))

async function must(label, promise) {
  const { data, error, count } = await promise
  if (error) throw new Error(`${label}: ${error.message}`)
  return { data, count }
}

async function selectIn(db, table, columns, column, values) {
  const rows = []
  for (const part of chunk(values)) rows.push(...(await must(table, db.from(table).select(columns).in(column, part))).data)
  return rows
}

async function listAllUsers(db) {
  const users = []
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw error
    users.push(...data.users)
    if (data.users.length < 1000) break
  }
  return users
}

async function collect(db) {
  const users = await listAllUsers(db)
  const email = user => user.email?.toLowerCase() ?? ''
  const tagged = users.filter(u => u.app_metadata?.seed === SEED_TAG)
  const skipped = tagged.filter(u => PROTECTED_EMAILS.includes(email(u)) || !email(u).endsWith(SEED_EMAIL_SUFFIX))
  const seededUsers = tagged.filter(u => !skipped.includes(u))
  const seededIds = seededUsers.map(u => u.id)
  const paisId = users.find(u => email(u) === 'pais@pais.com')?.id
  const teacherId = users.find(u => email(u) === 'professor@professor.com')?.id

  const seededChildren = await selectIn(db, 'children', 'id, full_name, birth_date, created_by', 'created_by', seededIds)
  const paisChildren = paisId
    ? (await must('children', db.from('children').select('id, full_name, birth_date, created_by').eq('created_by', paisId))).data
        .filter(c => PAIS_CHILDREN.some(p => p.full_name === c.full_name && p.birth_date === c.birth_date))
    : []
  const children = [...seededChildren, ...paisChildren]
  const childIds = children.map(c => c.id)

  const classes = teacherId
    ? (await must('children_classes', db.from('children_classes').select('id, name').eq('created_by', teacherId))).data
        .filter(c => DEMO_CLASSES.some(d => d.name === c.name))
    : []
  const classIds = classes.map(c => c.id)
  const classEnrollments = await selectIn(db, 'children_class_enrollments', 'class_id, child_id', 'class_id', classIds)
  const classCheckins = await selectIn(db, 'children_checkins', 'class_id, child_id', 'class_id', classIds)
  const foreignClassIds = new Set([...classEnrollments, ...classCheckins].filter(r => !childIds.includes(r.child_id)).map(r => r.class_id))

  return {
    seededUsers,
    skipped,
    seededIds,
    children,
    childIds,
    guardianLinks: [
      ...await selectIn(db, 'child_guardians', 'child_id, guardian_id', 'child_id', childIds),
      ...(await selectIn(db, 'child_guardians', 'child_id, guardian_id', 'guardian_id', seededIds)).filter(r => !childIds.includes(r.child_id))
    ],
    enrollments: await selectIn(db, 'children_class_enrollments', 'class_id, child_id', 'child_id', childIds),
    checkins: await selectIn(db, 'children_checkins', 'id', 'child_id', childIds),
    familyMembers: await selectIn(db, 'family_members', 'id', 'owner_id', seededIds),
    profiles: await selectIn(db, 'profiles', 'id', 'id', seededIds),
    roles: await selectIn(db, 'user_system_roles', 'user_id, role', 'user_id', seededIds),
    classes: classes.filter(c => !foreignClassIds.has(c.id)),
    keptClasses: classes.filter(c => foreignClassIds.has(c.id)),
    paisChildren
  }
}

function report(found) {
  console.log(apply ? 'Removendo dados de demonstração…' : 'SIMULAÇÃO (nada será removido; use --apply para remover):')
  console.table({
    'contas marcadas (auth)': found.seededUsers.length,
    'perfis': found.profiles.length,
    'papéis (user_system_roles)': found.roles.length,
    'family_members': found.familyMembers.length,
    'crianças (total)': found.children.length,
    '  das quais de pais@pais.com': found.paisChildren.length,
    'vínculos de responsáveis': found.guardianLinks.length,
    'matrículas': found.enrollments.length,
    'check-ins': found.checkins.length,
    'salas de demonstração': found.classes.length
  })
  if (found.skipped.length) console.warn(`Ignoradas ${found.skipped.length} conta(s) marcadas porém protegidas/fora de ${SEED_EMAIL_SUFFIX}: ${found.skipped.map(u => u.email).join(', ')}`)
  if (found.keptClasses.length) console.warn(`Salas mantidas por terem crianças de fora da demonstração: ${found.keptClasses.map(c => c.name).join(', ')}`)
}

async function remove(db, found) {
  const failures = []
  const run = async (label, promise) => {
    const { error } = await promise
    if (error) failures.push(`${label}: ${error.message}`)
  }
  // Crianças primeiro: a exclusão leva junto responsáveis, matrículas, check-ins e alertas.
  for (const part of chunk(found.childIds)) await run('crianças', db.from('children').delete().in('id', part))
  for (const part of chunk(found.seededIds)) {
    await run('vínculos restantes', db.from('child_guardians').delete().in('guardian_id', part))
    await run('family_members', db.from('family_members').delete().in('owner_id', part))
  }
  for (const part of chunk(found.classes.map(c => c.id))) await run('salas', db.from('children_classes').delete().in('id', part))
  // Excluir a conta remove o perfil e os papéis em cascata.
  for (const user of found.seededUsers) {
    const { error } = await db.auth.admin.deleteUser(user.id)
    if (error) failures.push(`conta ${user.email}: ${error.message}`)
  }
  return failures
}

async function main() {
  const url = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    console.error('Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.')
    process.exit(1)
  }
  const db = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
  const found = await collect(db)
  report(found)
  if (!apply) return
  const failures = await remove(db, found)
  if (failures.length) {
    console.log(`\n${failures.length} falha(s):`)
    for (const failure of failures) console.log(`  - ${failure}`)
    process.exitCode = 1
    return
  }
  console.log('\nConcluído. Rode de novo sem --apply para conferir que não restou nada.')
}

main().catch((error) => {
  console.error('Falha geral:', error.message)
  process.exit(1)
})
