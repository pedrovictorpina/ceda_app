import type { ChildAlert, ChildAlertReason, ChildCheckin, ChildClass, ChildRecord, ClassFormValue } from '~/types/children'
import type { ActionResult } from '~/composables/useFamilyChildren'
import { isCheckinActive, latestAlertByCheckin } from '~/utils/childCheckin'
import { friendlyDatabaseError } from '~/utils/databaseErrors'

export interface ManagedClass extends ChildClass {
  teacherIds: string[]
  children: ChildRecord[]
}

export interface RosterEntry extends ChildCheckin {
  child: ChildRecord
}

interface ClassRow extends ChildClass {
  children_class_teachers: Array<{ teacher_id: string }> | null
  children_class_enrollments: Array<{ child: ChildRecord | null }> | null
}

const CHILD_COLUMNS = 'id, full_name, birth_date, allergies, photo_path'
const CLASS_COLUMNS = 'id, name, min_age, max_age, room, notes, archived_at'
const SEARCH_LIMIT = 20

function escapeLike(term: string) {
  return term.replace(/[\\%_]/g, character => `\\${character}`)
}

function byName(a: ChildRecord, b: ChildRecord) {
  return a.full_name.localeCompare(b.full_name, 'pt-BR')
}

/** Estado da área dos professores: turmas, lista da salinha e alertas. */
export function useChildrenClasses() {
  const auth = useAuthStore()
  const photos = useChildPhotos()
  const classes = ref<ManagedClass[]>([])
  const roster = ref<RosterEntry[]>([])
  const alerts = ref<ChildAlert[]>([])
  const loading = ref(true)
  const loadError = ref('')

  const myId = computed(() => auth.profile?.id ?? '')
  const activeClasses = computed(() => classes.value.filter(item => !item.archived_at))
  const archivedClasses = computed(() => classes.value.filter(item => item.archived_at))
  const alertSummaries = computed(() => latestAlertByCheckin(alerts.value))

  function teaches(item: ManagedClass) {
    return item.teacherIds.includes(myId.value)
  }

  /**
   * RLS lê os papéis do JWT. Quem acabou de receber o papel de professor ainda
   * tem um token antigo; renovamos a sessão uma vez para liberar o acesso.
   */
  async function ensureFreshRoles() {
    const { $supabase } = useNuxtApp()
    if (!$supabase || !auth.profile || auth.profile.isChildrenTeam) return
    const { data } = await $supabase.auth.getSession()
    const tokenRoles: unknown = data.session?.user.app_metadata?.roles
    const roles = Array.isArray(tokenRoles) ? tokenRoles : []
    if (!roles.includes('teacher') && !roles.includes('administrator')) await $supabase.auth.refreshSession()
  }

  async function load(silent = false) {
    const { $supabase } = useNuxtApp()
    if (!$supabase || !auth.profile) {
      loadError.value = $supabase ? '' : 'O serviço de dados não está configurado neste ambiente.'
      loading.value = false
      return
    }
    if (!silent) loading.value = true
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const [classesResult, rosterResult] = await Promise.all([
      $supabase.from('children_classes')
        .select(`${CLASS_COLUMNS}, children_class_teachers(teacher_id), children_class_enrollments(child:children(${CHILD_COLUMNS}))`)
        .order('name'),
      // RLS returns only the rosters of classes this teacher runs (administrators: all).
      $supabase.from('children_checkins')
        .select(`id, child_id, class_id, status, checked_in_at, checked_out_at, child:children(${CHILD_COLUMNS})`)
        .eq('status', 'checked_in')
        .gte('checked_in_at', since)
        .order('checked_in_at')
    ])
    const openRoster = ((rosterResult.data || []) as unknown as RosterEntry[]).filter(entry => entry.child && isCheckinActive(entry))
    const alertsResult = openRoster.length
      ? await $supabase.from('children_alerts')
          .select('id, child_id, class_id, checkin_id, reason, message, acknowledged_at, created_at')
          .in('checkin_id', openRoster.map(entry => entry.id))
      : { data: [], error: null }

    loadError.value = classesResult.error || rosterResult.error || alertsResult.error
      ? 'Não foi possível atualizar as turmas. Verifique sua conexão e toque em Atualizar.'
      : ''
    if (!classesResult.error) {
      classes.value = ((classesResult.data || []) as unknown as ClassRow[]).map(({ children_class_teachers: teachers, children_class_enrollments: enrollments, ...item }) => ({
        ...item,
        teacherIds: (teachers || []).map(teacher => teacher.teacher_id),
        children: (enrollments || []).flatMap(enrollment => enrollment.child ? [enrollment.child] : []).sort(byName)
      }))
    }
    if (!rosterResult.error) roster.value = openRoster
    if (!alertsResult.error) alerts.value = (alertsResult.data || []) as ChildAlert[]
    await photos.resolvePhotos([
      ...roster.value.map(entry => entry.child.photo_path),
      ...classes.value.flatMap(item => item.children.map(child => child.photo_path))
    ])
    loading.value = false
  }

  async function mutate(run: () => PromiseLike<{ error: { code?: string, message?: string } | null }>, fallback: string): Promise<ActionResult> {
    try {
      const { error } = await run()
      if (error) return { ok: false, message: friendlyDatabaseError(error, fallback) }
    } catch (error: unknown) {
      return { ok: false, message: error instanceof Error ? error.message : fallback }
    }
    await load(true)
    return { ok: true }
  }

  function client() {
    const { $supabase } = useNuxtApp()
    if (!$supabase) throw new Error('O serviço de dados não está configurado.')
    return $supabase
  }

  function saveClass(form: ClassFormValue, existing?: ManagedClass) {
    const values = {
      name: form.name.trim(),
      min_age: form.minAge,
      max_age: form.maxAge,
      room: form.room.trim() || null,
      notes: form.notes.trim() || null
    }
    return mutate(
      () => existing
        ? client().from('children_classes').update(values).eq('id', existing.id)
        : client().from('children_classes').insert({ ...values, created_by: myId.value }),
      existing ? 'Não foi possível salvar a turma. Tente novamente.' : 'Não foi possível criar a turma. Confira se já existe uma turma ativa com esse nome.'
    )
  }

  function setArchived(item: ManagedClass, archived: boolean) {
    return mutate(
      () => client().from('children_classes').update({ archived_at: archived ? new Date().toISOString() : null }).eq('id', item.id),
      archived ? 'Não foi possível arquivar a turma.' : 'Não foi possível reativar a turma. Confira se já existe uma turma ativa com esse nome.'
    )
  }

  function joinClass(item: ManagedClass) {
    return mutate(
      () => client().from('children_class_teachers').insert({ class_id: item.id, teacher_id: myId.value, added_by: myId.value }),
      'Não foi possível entrar na turma.'
    )
  }

  function leaveClass(item: ManagedClass) {
    return mutate(
      () => client().from('children_class_teachers').delete().eq('class_id', item.id).eq('teacher_id', myId.value),
      'Não foi possível sair da turma.'
    )
  }

  function enroll(item: ManagedClass, child: ChildRecord) {
    return mutate(
      () => client().from('children_class_enrollments').insert({ class_id: item.id, child_id: child.id, added_by: myId.value }),
      'Não foi possível adicionar a criança à turma.'
    )
  }

  function unenroll(item: ManagedClass, child: ChildRecord) {
    return mutate(
      () => client().from('children_class_enrollments').delete().eq('class_id', item.id).eq('child_id', child.id),
      'Não foi possível retirar a criança da turma.'
    )
  }

  async function searchChildren(term: string): Promise<{ results: ChildRecord[], error: string }> {
    const trimmed = term.trim()
    if (trimmed.length < 2) return { results: [], error: '' }
    const { $supabase } = useNuxtApp()
    if (!$supabase) return { results: [], error: 'O serviço de dados não está configurado.' }
    const { data, error } = await $supabase.from('children')
      .select(CHILD_COLUMNS)
      .ilike('full_name', `%${escapeLike(trimmed)}%`)
      .order('full_name')
      .limit(SEARCH_LIMIT)
    if (error) return { results: [], error: 'Não foi possível buscar as crianças. Tente novamente.' }
    const results = (data || []) as ChildRecord[]
    await photos.resolvePhotos(results.map(child => child.photo_path))
    return { results, error: '' }
  }

  function sendAlert(checkinId: string, reason: ChildAlertReason, note: string) {
    return mutate(
      () => client().rpc('send_child_alert', { p_checkin_id: checkinId, p_reason: reason, p_note: note.trim() || null }),
      'Não foi possível enviar o alerta. Tente novamente.'
    )
  }

  function checkOut(checkinId: string) {
    return mutate(
      () => client().rpc('check_out_child', { p_checkin_id: checkinId }),
      'Não foi possível registrar a saída.'
    )
  }

  return {
    classes,
    activeClasses,
    archivedClasses,
    roster,
    alertSummaries,
    loading,
    loadError,
    teaches,
    photoUrl: photos.photoUrl,
    ensureFreshRoles,
    load,
    saveClass,
    setArchived,
    joinClass,
    leaveClass,
    enroll,
    unenroll,
    searchChildren,
    sendAlert,
    checkOut
  }
}
