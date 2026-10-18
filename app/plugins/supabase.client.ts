import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { Capacitor } from '@capacitor/core'
import { Preferences } from '@capacitor/preferences'
import { NativeRememberedSessionStorage, RememberedSessionStorage } from '~/utils/authSessionStorage'

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()
  const url = String(config.public.supabaseUrl || '')
  const key = String(config.public.supabasePublishableKey || '')
  const authStorage = Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('Preferences')
    ? new NativeRememberedSessionStorage({
        async getItem(key) { return (await Preferences.get({ key })).value },
        async setItem(key, value) { await Preferences.set({ key, value }) },
        async removeItem(key) { await Preferences.remove({ key }) }
      }, localStorage, sessionStorage)
    : new RememberedSessionStorage(localStorage, sessionStorage)
  const supabase: SupabaseClient | null = url && key
    ? createClient(url, key, {
        auth: {
          flowType: 'pkce',
          // Recovery exchanges its code explicitly and verifies the requested
          // flow. A normal signed-in session must not unlock password recovery.
          detectSessionInUrl: window.location.pathname.replace(/\/$/, '') !== '/redefinir-senha',
          persistSession: true,
          autoRefreshToken: true,
          storage: authStorage
        }
      })
    : null

  return { provide: { supabase, authStorage } }
})
