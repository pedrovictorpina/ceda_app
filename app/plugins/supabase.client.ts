import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { RememberedSessionStorage } from '~/utils/authSessionStorage'

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()
  const url = String(config.public.supabaseUrl || '')
  const key = String(config.public.supabasePublishableKey || '')
  const authStorage = new RememberedSessionStorage(localStorage, sessionStorage)
  const supabase: SupabaseClient | null = url && key
    ? createClient(url, key, {
        auth: {
          flowType: 'pkce',
          persistSession: true,
          autoRefreshToken: true,
          storage: authStorage
        }
      })
    : null

  return { provide: { supabase, authStorage } }
})
