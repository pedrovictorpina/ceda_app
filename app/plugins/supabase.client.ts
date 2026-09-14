import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()
  const url = String(config.public.supabaseUrl || '')
  const key = String(config.public.supabasePublishableKey || '')
  const supabase: SupabaseClient | null = url && key
    ? createClient(url, key, {
        auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true }
      })
    : null

  return { provide: { supabase } }
})
