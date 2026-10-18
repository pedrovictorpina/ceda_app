<script setup lang="ts">
import { safeAuthReturnTo } from '~/utils/authFlow'

definePageMeta({ middleware: 'auth' })
useSeoMeta({ title: 'Notificações' })
const { notifications, loading, errorMessage, markingId, hasMore, load: loadNotifications, markRead } = useInternalNotifications()
const unreadOnly = ref(false)
const visibleNotifications = computed(() => unreadOnly.value ? notifications.value.filter(item => !item.read_at) : notifications.value)
function notificationDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.valueOf()) ? 'Data indisponível' : new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}
function notificationTarget(link: string | null) {
  if (!link) return undefined
  const target = safeAuthReturnTo(link)
  return target === '/inicio' && link !== '/inicio' ? undefined : target
}
onMounted(() => loadNotifications())
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
      description="Os comunicados da liderança aparecem nesta área. Abra o aplicativo para consultar os avisos; eles não são enviados como alerta fora do app."
    />
    <div class="mb-5 flex flex-wrap items-center gap-3">
      <UCheckbox
        v-model="unreadOnly"
        label="Mostrar somente não lidas"
      />
      <UButton
        label="Atualizar"
        color="neutral"
        variant="outline"
        icon="i-lucide-refresh-cw"
        :loading="loading"
        @click="loadNotifications()"
      />
    </div>
    <UAlert
      v-if="errorMessage"
      class="mb-5"
      color="error"
      variant="subtle"
      :description="errorMessage"
      :actions="[{ label: 'Tentar novamente', onClick: () => loadNotifications() }]"
    />
    <div
      v-if="loading && !notifications.length"
      class="py-10 text-center text-muted"
    >
      <BrandLoader label="Carregando notificações…" />
    </div>
    <UCard v-else-if="!visibleNotifications.length && !errorMessage">
      <div class="py-10 text-center">
        <UIcon
          name="i-lucide-bell-ring"
          class="mx-auto size-10 text-muted"
        /><h2 class="mt-3 font-semibold">
          {{ unreadOnly ? 'Você está em dia com os avisos carregados' : 'Seus avisos aparecerão aqui' }}
        </h2><p class="mt-1 text-sm text-muted">
          {{ unreadOnly ? 'Você pode mostrar todos os avisos ou carregar os mais antigos.' : 'Quando a liderança enviar um comunicado para você, ele estará nesta área.' }}
        </p>
      </div>
    </UCard>
    <div
      v-else
      class="space-y-3"
    >
      <UCard
        v-for="notification in visibleNotifications"
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
              <time
                class="text-xs text-muted"
                :datetime="notification.created_at"
              >{{ notificationDate(notification.created_at) }}</time>
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
              v-if="notificationTarget(notification.deep_link)"
              :to="notificationTarget(notification.deep_link)"
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
              :loading="markingId === notification.id"
              :disabled="Boolean(markingId)"
              @click="markRead(notification)"
            />
          </div>
        </template>
      </UCard>
    </div>
    <UButton
      v-if="hasMore"
      class="mt-5"
      block
      color="neutral"
      variant="outline"
      label="Carregar avisos mais antigos"
      :loading="loading"
      @click="loadNotifications(true)"
    />
  </div>
</template>
