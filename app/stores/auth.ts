import type { SessionProfile } from '~/types/domain'

export const useAuthStore = defineStore('auth', () => {
  const profile = ref<SessionProfile | null>(null)
  const loading = ref(true)
  const configured = ref(false)

  async function hydrate() {
    const { $supabase } = useNuxtApp()
    configured.value = Boolean($supabase)
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
    const { data: row } = await $supabase
      .from('profiles')
      .select('id, full_name, email, avatar_path')
      .eq('id', data.user.id)
      .maybeSingle()
    const { data: roleRows } = await $supabase.from('user_system_roles').select('role').eq('user_id', data.user.id)
    const { data: guardian } = await $supabase.from('guardian_access').select('status').eq('user_id', data.user.id).eq('status', 'approved').maybeSingle()
    const { data: team } = await $supabase.from('children_team_members').select('user_id').eq('user_id', data.user.id).maybeSingle()
    profile.value = {
      id: data.user.id,
      name: row?.full_name || data.user.email || 'Membro',
      email: row?.email || data.user.email || '',
      avatarUrl: row?.avatar_path || undefined,
      roles: (roleRows || []).map(item => item.role),
      isApprovedGuardian: Boolean(guardian),
      isChildrenTeam: Boolean(team)
    }
    loading.value = false
  }

  async function signIn(email: string, password: string) {
    const { $supabase } = useNuxtApp()
    if (!$supabase) throw new Error('Supabase não configurado. Consulte o README.')
    const { error } = await $supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    await hydrate()
  }

  async function signOut() {
    const { $supabase } = useNuxtApp()
    await $supabase?.auth.signOut()
    profile.value = null
  }

  return { profile, loading, configured, hydrate, signIn, signOut }
})
