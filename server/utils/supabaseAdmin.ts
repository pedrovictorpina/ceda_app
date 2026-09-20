import { createClient } from '@supabase/supabase-js'

export function useSupabaseAdmin() {
  const config = useRuntimeConfig()
  const url = String(config.public.supabaseUrl || '')
  const serviceRoleKey = String(config.supabaseServiceRoleKey || '')

  if (!url || !serviceRoleKey) {
    throw createError({
      statusCode: 503,
      statusMessage: 'A gestão segura de cargos ainda não foi configurada neste ambiente.'
    })
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false
    }
  })
}

export function useSupabaseTokenVerifier() {
  const config = useRuntimeConfig()
  const url = String(config.public.supabaseUrl || '')
  const publishableKey = String(config.public.supabasePublishableKey || '')

  if (!url || !publishableKey) {
    throw createError({ statusCode: 503, statusMessage: 'O Supabase não está configurado neste ambiente.' })
  }

  return createClient(url, publishableKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false
    }
  })
}
