import type { SessionProfile } from '~/types/domain'
import type { User } from '@supabase/supabase-js'
import type { RegistrationInput } from '~/utils/registration'
import { birthdayProfileFields } from '../utils/birthdays'
import { authErrorMessage, authFlowLink } from '../utils/authFlow'
import { PasswordRecoveryGate } from '../utils/passwordRecovery'
import { normalizeSystemRoles } from '../utils/systemRoles'

export const useAuthStore = defineStore('auth', () => {
  const profile = ref<SessionProfile | null>(null)
  const loading = ref(true)
  const configured = ref(false)
  const sessionError = ref('')
  const rememberAccess = ref(false)
  let hydrationRevision = 0
  let hydration: { revision: number, promise: Promise<void> } | undefined

  function invalidateProfile() {
    hydrationRevision += 1
    profile.value = null
    loading.value = true
  }

  async function ensureProfile(user: User) {
    const { $supabase } = useNuxtApp()
    if (!$supabase) return null
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
    const baseProfile = { id: user.id, full_name: fullName, email: user.email || '', phone }
    const insertProfile = (values: Record<string, unknown>) => $supabase
      .from('profiles')
      .insert(values)
      .select('id, full_name, email, avatar_path')
      .single()
    const withBirthday = await insertProfile({ ...baseProfile, ...birthdayProfileFields(user.user_metadata) })
    // PGRST204: coluna ainda inexistente (migração de aniversariantes pendente); não bloqueia o primeiro acesso.
    const result = withBirthday.error?.code === 'PGRST204' ? await insertProfile(baseProfile) : withBirthday
    if (result.error) throw result.error
    return result.data
  }

  function hydrate(): Promise<void> {
    if (hydration?.revision === hydrationRevision) return hydration.promise
    const revision = ++hydrationRevision
    const promise = loadProfile(revision).finally(() => {
      if (hydration?.revision === revision) hydration = undefined
    })
    hydration = { revision, promise }
    return promise
  }

  async function loadProfile(revision: number) {
    loading.value = true
    sessionError.value = ''
    const { $supabase, $authStorage } = useNuxtApp()
    configured.value = Boolean($supabase)
    try {
      if ($authStorage && 'ready' in $authStorage) await $authStorage.ready()
      rememberAccess.value = $authStorage?.rememberAccess ?? false
      if (!$supabase) {
        if (revision === hydrationRevision) profile.value = null
        return
      }
      const { data, error } = await $supabase.auth.getUser()
      if (revision !== hydrationRevision) return
      if (error && error.name !== 'AuthSessionMissingError') throw error
      if (!data.user) {
        profile.value = null
        return
      }
      // All profile data belongs to this one verified identity, even when
      // another authentication operation runs while requests are in flight.
      const row = await ensureProfile(data.user)
      if (revision !== hydrationRevision) return
      const [roleResult, guardianResult, teamResult, childResult] = await Promise.all([
        $supabase.from('user_system_roles').select('role').eq('user_id', data.user.id),
        $supabase.from('guardian_access').select('status').eq('user_id', data.user.id).eq('status', 'approved').maybeSingle(),
        $supabase.from('children_team_members').select('user_id').eq('user_id', data.user.id).maybeSingle(),
        $supabase.from('child_guardians').select('child_id', { count: 'exact', head: true }).eq('guardian_id', data.user.id)
      ])
      if (revision !== hydrationRevision) return
      const queryError = roleResult.error || guardianResult.error || teamResult.error || childResult.error
      if (queryError) throw queryError
      const roleRows = roleResult.data
      if (!roleRows?.length) {
        const { error: roleError } = await $supabase.from('user_system_roles').insert({ user_id: data.user.id, role: 'member' })
        if (roleError && roleError.code !== '23505') throw roleError
      }
      if (revision !== hydrationRevision) return
      profile.value = {
        id: data.user.id,
        name: row?.full_name || data.user.email || 'Membro',
        email: row?.email || data.user.email || '',
        avatarUrl: row?.avatar_path || undefined,
        roles: normalizeSystemRoles(roleRows?.length ? roleRows.map(item => item.role) : ['member']),
        isApprovedGuardian: Boolean(guardianResult.data),
        isChildrenTeam: Boolean(teamResult.data),
        hasChildren: Boolean(childResult.count)
      }
    } catch (error) {
      if (revision === hydrationRevision) {
        profile.value = null
        sessionError.value = authErrorMessage(error, 'session')
      }
      throw error
    } finally {
      if (revision === hydrationRevision) loading.value = false
    }
  }

  async function setRememberAccess(value: boolean) {
    const { $authStorage } = useNuxtApp()
    await $authStorage?.setRememberAccess(value)
    rememberAccess.value = value
  }

  async function signIn(email: string, password: string, remember = false) {
    const { $supabase } = useNuxtApp()
    if (!$supabase) throw new Error('Supabase não configurado. Consulte o README.')
    await setRememberAccess(remember)
    const { error } = await $supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (error) throw error
    invalidateProfile()
    await hydrate()
    if (!profile.value) throw new Error('Não foi possível confirmar sua sessão. Entre novamente para continuar.')
  }

  async function signUp(input: RegistrationInput, returnTo: unknown = '/inicio') {
    const { $supabase } = useNuxtApp()
    if (!$supabase) throw new Error('Supabase não configurado. O cadastro não foi enviado.')
    const redirect = new URL(authFlowLink('/entrar', returnTo), window.location.origin)
    redirect.searchParams.set('cadastro', 'confirmado')
    const { data, error } = await $supabase.auth.signUp({
      email: input.email.trim(),
      password: input.password,
      options: {
        emailRedirectTo: redirect.href,
        data: {
          full_name: input.fullName.trim(),
          phone: input.phone.trim() || null,
          birth_date: input.birthDate || null,
          birthday_greetings_opt_in: Boolean(input.birthDate) && input.birthdayGreetingsOptIn
        }
      }
    })
    if (error) throw error
    if (data.session) {
      invalidateProfile()
      await hydrate()
    }
    return { requiresEmailConfirmation: !data.session }
  }

  async function requestPasswordReset(email: string, returnTo: unknown = '/inicio') {
    const { $supabase } = useNuxtApp()
    if (!$supabase) throw new Error('A recuperação de acesso está indisponível neste ambiente.')
    const gate = new PasswordRecoveryGate(localStorage, sessionStorage)
    const nonce = crypto.randomUUID()
    gate.begin(nonce)
    const redirect = new URL(authFlowLink('/redefinir-senha', returnTo), window.location.origin)
    redirect.searchParams.set('recuperacao', nonce)
    try {
      const { error } = await $supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: redirect.href })
      if (error) throw error
    } catch (error) {
      gate.cancel(nonce)
      throw error
    }
  }

  async function resendConfirmation(email: string, returnTo: unknown = '/inicio') {
    const { $supabase } = useNuxtApp()
    if (!$supabase) throw new Error('O envio está indisponível neste ambiente.')
    const redirect = new URL(authFlowLink('/entrar', returnTo), window.location.origin)
    redirect.searchParams.set('cadastro', 'confirmado')
    const { error } = await $supabase.auth.resend({
      type: 'signup',
      email: email.trim(),
      options: { emailRedirectTo: redirect.href }
    })
    if (error) throw error
  }

  async function preparePasswordReset(code: unknown, nonce: unknown) {
    const { $supabase } = useNuxtApp()
    if (!$supabase) return false
    const gate = new PasswordRecoveryGate(localStorage, sessionStorage)
    // Recovery disables automatic URL detection and checks the real PKCE code
    // before authorizing this specific tab and user. Normal sessions cannot
    // unlock this form, even when someone visits the URL directly.
    const initialized = await $supabase.auth.initialize()
    if (initialized.error) throw initialized.error
    if (typeof code === 'string' && code) {
      if (!gate.hasPending(nonce)) return false
      const { data, error } = await $supabase.auth.exchangeCodeForSession(code)
      if (error) throw error
      // The exchange can switch accounts. Never leave the previous account's
      // name or menus in memory while this new session is being verified.
      invalidateProfile()
      const redirectType = (data as typeof data & { redirectType?: unknown }).redirectType
      if (!data.user || !gate.authorize(data.user.id, nonce, redirectType)) return false
      const cleanUrl = new URL(window.location.href)
      cleanUrl.searchParams.delete('code')
      cleanUrl.searchParams.delete('recuperacao')
      window.history.replaceState(window.history.state, '', cleanUrl.href)
    }
    const { data, error } = await $supabase.auth.getUser()
    if (error) throw error
    return Boolean(data.user && gate.isAuthorized(data.user.id))
  }

  async function updatePassword(password: string) {
    const { $supabase } = useNuxtApp()
    if (!$supabase) throw new Error('A alteração de senha está indisponível neste ambiente.')
    const gate = new PasswordRecoveryGate(localStorage, sessionStorage)
    const current = await $supabase.auth.getUser()
    if (current.error) throw current.error
    if (!current.data.user || !gate.isAuthorized(current.data.user.id)) throw Object.assign(new Error('Recovery required'), { code: 'session_not_found' })
    const { error } = await $supabase.auth.updateUser({ password })
    if (error) throw error
    gate.clear()
  }

  async function signOut() {
    const { $supabase } = useNuxtApp()
    const result = await $supabase?.auth.signOut()
    if (result?.error) throw result.error
    hydrationRevision += 1
    new PasswordRecoveryGate(localStorage, sessionStorage).clear()
    profile.value = null
    loading.value = false
    sessionError.value = ''
  }

  return { profile, loading, configured, sessionError, rememberAccess, hydrate, setRememberAccess, signIn, signUp, requestPasswordReset, resendConfirmation, preparePasswordReset, updatePassword, signOut }
})
