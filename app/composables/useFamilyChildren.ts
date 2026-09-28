import type { ChildAlert, ChildCheckin, ChildClass, ChildFormValue, ChildRecord } from '~/types/children'
import { isCheckinActive, isSameServiceDay, pendingAlerts } from '~/utils/childCheckin'
import { friendlyDatabaseError } from '~/utils/databaseErrors'

export interface FamilyChild extends ChildRecord {
  classes: ChildClass[]
}

interface FamilyChildRow extends ChildRecord {
  children_class_enrollments: Array<{ class: ChildClass | null }> | null
}

export interface ChildSaveRequest {
  child?: FamilyChild
  form: ChildFormValue
  photo: File | null
  removePhoto: boolean
}

export type ActionResult = { ok: true, warning?: string } | { ok: false, message: string }

const CHILD_COLUMNS = 'id, full_name, birth_date, allergies, photo_path'
const CLASS_COLUMNS = 'id, name, min_age, max_age, room, notes, archived_at'

/** Estado da área dos responsáveis: filhos, turmas, check-ins e alertas. */
export function useFamilyChildren() {
  const auth = useAuthStore()
  const photos = useChildPhotos()
  const children = ref<FamilyChild[]>([])
  const checkins = ref<ChildCheckin[]>([])
  const alerts = ref<ChildAlert[]>([])
  const loading = ref(true)
  const loadError = ref('')

  const openAlerts = computed(() => pendingAlerts(alerts.value.filter(alert => isSameServiceDay(alert.created_at))))

  function activeCheckin(childId: string) {
    return checkins.value.find(checkin => checkin.child_id === childId && isCheckinActive(checkin))
  }

  async function load(silent = false) {
    const { $supabase } = useNuxtApp()
    if (!$supabase || !auth.profile) {
      loadError.value = $supabase ? '' : 'O serviço de dados não está configurado neste ambiente.'
      loading.value = false
      return
    }
    if (!silent) loading.value = true
    const guardianId = auth.profile.id
    // Teachers can read every child; the inner join keeps this page to "my children".
    const childrenResult = await $supabase
      .from('children')
      .select(`${CHILD_COLUMNS}, child_guardians!inner(guardian_id), children_class_enrollments(class:children_classes(${CLASS_COLUMNS}))`)
      .eq('child_guardians.guardian_id', guardianId)
      .order('full_name')
    const rows = (childrenResult.data || []) as unknown as FamilyChildRow[]
    const ids = rows.map(row => row.id)
    const [checkinsResult, alertsResult] = await Promise.all([
      ids.length
        ? $supabase.from('children_checkins').select('id, child_id, class_id, status, checked_in_at, checked_out_at').in('child_id', ids).eq('status', 'checked_in')
        : Promise.resolve({ data: [], error: null }),
      $supabase.from('children_alerts')
        .select('id, child_id, class_id, checkin_id, reason, message, acknowledged_at, created_at')
        .eq('guardian_id', guardianId)
        .is('acknowledged_at', null)
        .order('created_at', { ascending: false })
        .limit(20)
    ])

    const failed = childrenResult.error || checkinsResult.error || alertsResult.error
    loadError.value = failed ? 'Não foi possível atualizar o Sementinhas. Verifique sua conexão e toque em Atualizar.' : ''
    if (!childrenResult.error) {
      children.value = rows.map(({ children_class_enrollments: enrollments, ...child }) => ({
        ...child,
        classes: (enrollments || [])
          .flatMap(item => item.class && !item.class.archived_at ? [item.class] : [])
          .sort((a, b) => a.min_age - b.min_age || a.name.localeCompare(b.name, 'pt-BR'))
      }))
      await photos.resolvePhotos(children.value.map(child => child.photo_path))
    }
    if (!checkinsResult.error) checkins.value = (checkinsResult.data || []) as ChildCheckin[]
    if (!alertsResult.error) alerts.value = (alertsResult.data || []) as ChildAlert[]
    loading.value = false
  }

  async function runRpc(name: string, args: Record<string, unknown>, fallback: string): Promise<ActionResult> {
    const { $supabase } = useNuxtApp()
    if (!$supabase) return { ok: false, message: 'O serviço de dados não está configurado.' }
    const { error } = await $supabase.rpc(name, args)
    if (error) return { ok: false, message: friendlyDatabaseError(error, fallback) }
    await load(true)
    return { ok: true }
  }

  function checkIn(childId: string, classId: string) {
    return runRpc('check_in_child', { p_child_id: childId, p_class_id: classId }, 'Não foi possível fazer o check-in. Tente novamente.')
  }

  function checkOut(checkinId: string) {
    return runRpc('check_out_child', { p_checkin_id: checkinId }, 'Não foi possível registrar a saída. Tente novamente.')
  }

  function acknowledge(alertId: string) {
    return runRpc('acknowledge_child_alert', { p_alert_id: alertId }, 'Não foi possível confirmar o alerta. Tente novamente.')
  }

  async function registerChild(request: ChildSaveRequest): Promise<ActionResult> {
    const { $supabase } = useNuxtApp()
    if (!$supabase) return { ok: false, message: 'O serviço de dados não está configurado.' }
    const { data: childId, error } = await $supabase.rpc('register_child', {
      p_full_name: request.form.fullName.trim(),
      p_birth_date: request.form.birthDate,
      p_allergies: request.form.allergies.trim() || null
    })
    if (error || typeof childId !== 'string') {
      return { ok: false, message: friendlyDatabaseError(error, 'Não foi possível cadastrar a criança. Tente novamente.') }
    }
    const warning = request.photo ? await attachPhoto(childId, request.photo) : undefined
    await load(true)
    return { ok: true, warning }
  }

  async function attachPhoto(childId: string, photo: File): Promise<string | undefined> {
    const { $supabase } = useNuxtApp()
    if (!$supabase) return 'A criança foi cadastrada, mas a foto não foi salva.'
    try {
      const path = await photos.uploadPhoto(childId, photo)
      const { error } = await $supabase.from('children').update({ photo_path: path }).eq('id', childId)
      if (error) {
        await photos.removePhoto(path)
        return 'A criança foi cadastrada, mas a foto não foi salva. Tente adicioná-la em Editar.'
      }
      return undefined
    } catch (error: unknown) {
      return error instanceof Error ? `A criança foi cadastrada, mas a foto não foi salva: ${error.message}` : 'A criança foi cadastrada, mas a foto não foi salva.'
    }
  }

  async function updateChild(request: ChildSaveRequest & { child: FamilyChild }): Promise<ActionResult> {
    const { $supabase } = useNuxtApp()
    if (!$supabase) return { ok: false, message: 'O serviço de dados não está configurado.' }
    const previousPhoto = request.child.photo_path
    let newPhoto: string | null = null
    try {
      if (request.photo) newPhoto = await photos.uploadPhoto(request.child.id, request.photo)
    } catch (error: unknown) {
      return { ok: false, message: error instanceof Error ? error.message : 'Não foi possível enviar a foto.' }
    }
    const photoChanged = Boolean(newPhoto) || (request.removePhoto && Boolean(previousPhoto))
    const { error } = await $supabase.from('children').update({
      full_name: request.form.fullName.trim(),
      birth_date: request.form.birthDate,
      allergies: request.form.allergies.trim() || null,
      ...(photoChanged ? { photo_path: newPhoto } : {})
    }).eq('id', request.child.id)
    if (error) {
      if (newPhoto) await photos.removePhoto(newPhoto)
      return { ok: false, message: friendlyDatabaseError(error, 'Não foi possível salvar as alterações. Tente novamente.') }
    }
    if (photoChanged && previousPhoto) await photos.removePhoto(previousPhoto)
    await load(true)
    return { ok: true }
  }

  async function removeChild(child: FamilyChild): Promise<ActionResult> {
    const { $supabase } = useNuxtApp()
    if (!$supabase) return { ok: false, message: 'O serviço de dados não está configurado.' }
    const { data, error } = await $supabase.rpc('remove_child', { p_child_id: child.id })
    if (error) return { ok: false, message: friendlyDatabaseError(error, 'Não foi possível remover a criança. Tente novamente.') }
    const result = (data || {}) as { deleted?: boolean, photo_path?: string | null }
    if (result.deleted && result.photo_path) await photos.removePhoto(result.photo_path)
    await load(true)
    return result.deleted
      ? { ok: true }
      : { ok: true, warning: 'Seu vínculo foi removido. A criança continua cadastrada para os outros responsáveis.' }
  }

  return {
    children,
    checkins,
    openAlerts,
    loading,
    loadError,
    activeCheckin,
    photoUrl: photos.photoUrl,
    load,
    checkIn,
    checkOut,
    acknowledge,
    registerChild,
    updateChild,
    removeChild
  }
}
