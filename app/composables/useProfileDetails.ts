import { validateBirthDate } from '../utils/birthdays'

interface ProfileFields {
  name: string
  email: string
  phone: string
  sex: string
  birthDate: string
  notificationsEnabled: boolean
  birthdayGreetingsOptIn: boolean
}

export function useProfileDetails() {
  const auth = useAuthStore()
  const initialFields = (): ProfileFields => ({ name: auth.profile?.name || '', email: auth.profile?.email || '', phone: '', sex: '', birthDate: '', notificationsEnabled: false, birthdayGreetingsOptIn: false })
  const form = reactive(initialFields())
  const loading = ref(true)
  const ready = ref(false)
  const saving = ref(false)
  const errorMessage = ref('')
  const status = ref('')
  const birthdayOptInAvailable = ref(false)
  const baseline = ref('')
  const dirty = computed(() => ready.value && JSON.stringify(form) !== baseline.value)
  let request = 0
  let disposed = false
  const belongsTo = (userId: string) => !disposed && auth.profile?.id === userId
  const applyUnedited = (before: ProfileFields, values: ProfileFields) => {
    for (const key of Object.keys(values) as Array<keyof ProfileFields>) {
      if (form[key] === before[key]) Object.assign(form, { [key]: values[key] })
    }
  }
  watch(() => auth.profile?.id, () => {
    ++request
    Object.assign(form, initialFields())
    baseline.value = ''
    ready.value = false
    loading.value = false
    birthdayOptInAvailable.value = false
    status.value = ''
    errorMessage.value = 'Seu acesso mudou. Carregue novamente o perfil antes de editar.'
  }, { flush: 'sync' })
  onBeforeUnmount(() => {
    disposed = true
  })

  async function load(): Promise<{ avatar_path: string | null } | null> {
    if (saving.value || dirty.value) return null
    const current = ++request
    const userId = auth.profile?.id
    const before = { ...form }
    loading.value = true
    errorMessage.value = ''
    try {
      const { $supabase } = useNuxtApp()
      if (!$supabase || !userId) throw new Error('session')
      const columns = 'full_name, email, phone, sex, birth_date, avatar_path, notifications_enabled'
      let result = await $supabase.from('profiles').select(`${columns}, birthday_greetings_opt_in`).eq('id', userId).maybeSingle()
      const missingBirthdayColumn = ['PGRST204', '42703'].includes(result.error?.code || '')
      if (missingBirthdayColumn) result = await $supabase.from('profiles').select(columns).eq('id', userId).maybeSingle()
      if (result.error || !result.data) throw result.error || new Error('profile-missing')
      if (!belongsTo(userId) || current !== request) return null
      const data = result.data
      const loaded = {
        name: data.full_name || '', email: data.email || '', phone: data.phone || '', sex: data.sex || '',
        birthDate: data.birth_date || '', notificationsEnabled: data.notifications_enabled === true,
        birthdayGreetingsOptIn: !missingBirthdayColumn && data.birthday_greetings_opt_in === true
      }
      applyUnedited(before, loaded)
      baseline.value = JSON.stringify(loaded)
      birthdayOptInAvailable.value = !missingBirthdayColumn
      ready.value = true
      return { avatar_path: data.avatar_path || null }
    } catch {
      if (current === request && (!userId || belongsTo(userId))) errorMessage.value = 'Não foi possível carregar seu perfil. Seus dados não foram alterados. Tente novamente antes de editar.'
      return null
    } finally { if (current === request) loading.value = false }
  }

  async function save(): Promise<boolean> {
    if (saving.value) return false
    const userId = auth.profile?.id
    if (!ready.value || loading.value) {
      status.value = 'Aguarde o carregamento do perfil ou tente carregar novamente antes de salvar.'
      return false
    }
    const before = { ...form }
    const submitted = { ...before, name: before.name.trim(), phone: before.phone.trim() }
    const birthDateError = validateBirthDate(submitted.birthDate)
    if (!submitted.name || birthDateError || (submitted.birthdayGreetingsOptIn && !submitted.birthDate)) {
      status.value = !submitted.name ? 'Informe seu nome antes de salvar.' : birthDateError || 'Informe sua data de nascimento para receber felicitações.'
      return false
    }
    saving.value = true
    status.value = ''
    try {
      const { $supabase } = useNuxtApp()
      if (!$supabase || !userId) throw new Error('session')
      const { data, error } = await $supabase.from('profiles').update({
        full_name: submitted.name, phone: submitted.phone || null, sex: submitted.sex || null,
        birth_date: submitted.birthDate || null, notifications_enabled: submitted.notificationsEnabled,
        ...(birthdayOptInAvailable.value ? { birthday_greetings_opt_in: submitted.birthdayGreetingsOptIn } : {})
      }).eq('id', userId).select('id').single()
      if (error || data?.id !== userId) throw error || new Error('not-updated')
      if (!belongsTo(userId)) return false
      applyUnedited(before, submitted)
      baseline.value = JSON.stringify(submitted)
      if (auth.profile) auth.profile.name = submitted.name
      status.value = dirty.value ? 'As alterações enviadas foram salvas. Há novas alterações nesta tela que ainda precisam ser salvas.' : 'Perfil atualizado com sucesso.'
      return true
    } catch {
      if (!userId || belongsTo(userId)) status.value = 'Não foi possível salvar as alterações. Seus dados continuam nesta tela; confira a conexão e tente novamente.'
      return false
    } finally { saving.value = false }
  }

  return { form, loading, ready, saving, errorMessage, status, birthdayOptInAvailable, dirty, load, save }
}
