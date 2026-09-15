import type { SessionProfile } from '~/types/domain'
import type { RegistrationInput } from '~/utils/registration'

export const useAuthStore = defineStore('auth', () => {
  const profile = ref<SessionProfile | null>(null)
  const loading = ref(true)
  const configured = ref(false)
  const rememberAccess = ref(false)

  async function ensureProfile() {
    const { $supabase } = useNuxtApp()
    if (!$supabase) return null
    const { data: { user } } = await $supabase.auth.getUser()
    if (!user) return null

    const { data: existing, error: readError } = await $supabase
      .from('profiles')
      .select('id, full_name, email, avatar_path')
      .eq('id', user.id)
      .maybeSingle()
    if (readError) throw readError
    if (existing) return existing

    const fullName = typeof user.user_metadata.full_name === 'string'
      ? user.user_metadata.full_name.slice(0, 120)
      : user.email || 'Membro'
    const phone = typeof user.user_metadata.phone === 'string'
      ? user.user_metadata.phone.slice(0, 30)
      : null
    const { data: created, error: createError } = await $supabase
      .from('profiles')
      .insert({ id: user.id, full_name: fullName, email: user.email || '', phone })
      .select('id, full_name, email, avatar_path')
      .single()
    if (createError) throw createError
    return created
  }

  async function hydrate() {
    const { $supabase, $authStorage } = useNuxtApp()
    configured.value = Boolean($supabase)
    rememberAccess.value = $authStorage?.rememberAccess ?? false
    if (!$supabase) {
      loading.value = false
      return
    }
    const { data } = await $supabase.auth.getUser()
    if (!data.user) {
      profile.value = null
      loading.value = false
      return
    }
    const row = await ensureProfile()
    const { data: roleRows } = await $supabase.from('user_system_roles').select('role').eq('user_id', data.user.id)
    if (!roleRows?.length) {
      const { error: roleError } = await $supabase.from('user_system_roles').insert({ user_id: data.user.id, role: 'member' })
      if (roleError && roleError.code !== '23505') throw roleError
    }
    const { data: guardian } = await $supabase.from('guardian_access').select('status').eq('user_id', data.user.id).eq('status', 'approved').maybeSingle()
    const { data: team } = await $supabase.from('children_team_members').select('user_id').eq('user_id', data.user.id).maybeSingle()
    profile.value = {
      id: data.user.id,
      name: row?.full_name || data.user.email || 'Membro',
      email: row?.email || data.user.email || '',
      avatarUrl: row?.avatar_path || undefined,
      roles: roleRows?.length ? roleRows.map(item => item.role) : ['member'],
      isApprovedGuardian: Boolean(guardian),
      isChildrenTeam: Boolean(team)
    }
    loading.value = false
  }

  function setRememberAccess(value: boolean) {
    const { $authStorage } = useNuxtApp()
    rememberAccess.value = value
    $authStorage?.setRememberAccess(value)
  }

  async function signIn(email: string, password: string, remember = false) {
    const { $supabase } = useNuxtApp()
    if (!$supabase) throw new Error('Supabase não configurado. Consulte o README.')
    setRememberAccess(remember)
    const { error } = await $supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    await hydrate()
  }

  async function signUp(input: RegistrationInput) {
    const { $supabase } = useNuxtApp()
    if (!$supabase) throw new Error('Supabase não configurado. O cadastro não foi enviado.')
    const { data, error } = await $supabase.auth.signUp({
      email: input.email.trim(),
      password: input.password,
      options: {
        emailRedirectTo: `${window.location.origin}/entrar?cadastro=confirmado`,
        data: {
          full_name: input.fullName.trim(),
          phone: input.phone.trim() || null
        }
      }
    })
    if (error) throw error
    if (data.session) await hydrate()
    return { requiresEmailConfirmation: !data.session }
  }

  async function signOut() {
    const { $supabase } = useNuxtApp()
    await $supabase?.auth.signOut()
    profile.value = null
  }

  return { profile, loading, configured, rememberAccess, hydrate, setRememberAccess, signIn, signUp, signOut }
})
