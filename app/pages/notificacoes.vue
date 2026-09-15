<script setup lang="ts">
definePageMeta({ middleware: 'auth' })
useSeoMeta({ title: 'Notificações' })

interface InternalNotification {
  id: string
  title: string
  body: string
  deep_link: string | null
  read_at: string | null
  created_at: string
  source_cell_id: string | null
}

const auth = useAuthStore()
const notifications = ref<InternalNotification[]>([])
const loading = ref(true)
const errorMessage = ref('')

onMounted(loadNotifications)

async function loadNotifications() {
  loading.value = true
  const { $supabase } = useNuxtApp()
  if (!$supabase || !auth.profile) {
    loading.value = false
    return
  }
  const { data, error } = await $supabase
    .from('notifications')
    .select('id, title, body, deep_link, read_at, created_at, source_cell_id')
    .order('created_at', { ascending: false })
  if (error) errorMessage.value = error.message
  else notifications.value = data
  loading.value = false
}

async function markRead(notification: InternalNotification) {
  if (notification.read_at) return
  const { $supabase } = useNuxtApp()
  const readAt = new Date().toISOString()
  const { error } = await $supabase?.from('notifications').update({ read_at: readAt }).eq('id', notification.id) || { error: null }
  if (error) errorMessage.value = error.message
  else notification.read_at = readAt
}
</script>

<template>
  <div>
    <PageIntro
      title="Notificações"
      description="Avisos, lembretes e chamados importantes em um só lugar."
      icon="i-lucide-bell"
    />
    <UAlert
      class="mb-5"
      color="neutral"
      variant="subtle"
      title="Notificações internas"
      description="Comunicados publicados por líderes aparecem aqui. O fluxo está preparado para um provedor de push futuro, mas não afirma envio externo."
    />
    <UAlert
      v-if="errorMessage"
      class="mb-5"
      color="error"
      variant="subtle"
      :description="errorMessage"
    />
    <div
      v-if="loading"
      class="py-10 text-center text-muted"
    >
      Carregando notificações…
    </div>
    <UCard v-else-if="!notifications.length">
      <div class="py-10 text-center">
        <UIcon
          name="i-lucide-bell-ring"
          class="mx-auto size-10 text-muted"
        /><h2 class="mt-3 font-semibold">
          Nenhuma notificação nova
        </h2><p class="mt-1 text-sm text-muted">
          Comunicados e lembretes internos aparecerão aqui. Nenhum push externo foi enviado.
        </p>
      </div>
    </UCard>
    <div
      v-else
      class="space-y-3"
    >
      <UCard
        v-for="notification in notifications"
        :key="notification.id"
        :class="notification.read_at ? 'opacity-75' : ''"
      >
        <div class="flex items-start gap-3">
          <span
            class="mt-1 size-2 shrink-0 rounded-full"
            :class="notification.read_at ? 'bg-muted' : 'bg-primary'"
          />
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <h2 class="font-semibold">
                {{ notification.title }}
              </h2>
              <UBadge
                v-if="notification.source_cell_id"
                color="neutral"
                variant="subtle"
              >
                Célula
              </UBadge>
            </div>
            <p class="mt-1 whitespace-pre-line text-sm text-muted">
              {{ notification.body }}
            </p>
          </div>
        </div>
        <template #footer>
          <div class="flex flex-wrap gap-2">
            <UButton
              v-if="notification.deep_link"
              :to="notification.deep_link"
              size="sm"
              variant="soft"
              label="Abrir"
              @click="markRead(notification)"
            />
            <UButton
              v-if="!notification.read_at"
              size="sm"
              color="neutral"
              variant="ghost"
              label="Marcar como lida"
              @click="markRead(notification)"
            />
          </div>
        </template>
      </UCard>
    </div>
  </div>
</template>
