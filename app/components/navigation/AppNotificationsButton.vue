<script setup lang="ts">
const REFRESH_MS = 60_000

const auth = useAuthStore()
const route = useRoute()
const unread = ref(0)
let timer: ReturnType<typeof setInterval> | undefined

const label = computed(() => unread.value
  ? `Notificações, ${unread.value} não ${unread.value === 1 ? 'lida' : 'lidas'}`
  : 'Notificações')
const badge = computed(() => unread.value > 9 ? '9+' : String(unread.value))

async function refreshUnread() {
  const { $supabase } = useNuxtApp()
  if (!$supabase || !auth.profile || document.visibilityState !== 'visible') return
  const { count, error } = await $supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', auth.profile.id)
    .is('read_at', null)
  // Sem contador em caso de falha: o sino continua levando às notificações.
  if (!error) unread.value = count ?? 0
}

watch(() => route.path, () => void refreshUnread())

onMounted(() => {
  void refreshUnread()
  timer = setInterval(() => void refreshUnread(), REFRESH_MS)
})
onUnmounted(() => {
  if (timer) clearInterval(timer)
})
</script>

<template>
  <UChip
    :show="unread > 0"
    :text="badge"
    size="3xl"
    inset
  >
    <UButton
      color="neutral"
      variant="ghost"
      icon="i-lucide-bell"
      to="/notificacoes"
      :aria-label="label"
      :title="label"
    />
  </UChip>
</template>
