<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: ['auth', 'admin'] })
useSeoMeta({ title: 'Auditoria administrativa' })

interface AuditEntry {
  id: number
  actor_id: string
  action: 'content_created' | 'content_updated' | 'content_deleted' | 'membership_approved' | 'membership_rejected' | 'membership_updated'
  entity_type: 'daily_message' | 'community_membership'
  entity_id: string | null
  subject_user_id: string | null
  details: Record<string, unknown>
  created_at: string
}

interface ProfileName {
  id: string
  full_name: string
  email: string
}

const loading = ref(true)
const errorMessage = ref('')
const entries = ref<AuditEntry[]>([])
const people = ref<Record<string, ProfileName>>({})
const search = ref('')

const actionLabels: Record<AuditEntry['action'], string> = {
  content_created: 'Conteúdo criado',
  content_updated: 'Conteúdo atualizado',
  content_deleted: 'Conteúdo removido',
  membership_approved: 'Participação aprovada',
  membership_rejected: 'Participação recusada',
  membership_updated: 'Participação atualizada'
}

const visibleEntries = computed(() => {
  const term = search.value.trim().toLocaleLowerCase('pt-BR')
  if (!term) return entries.value
  return entries.value.filter((entry) => {
    const actor = people.value[entry.actor_id]
    const subject = entry.subject_user_id ? people.value[entry.subject_user_id] : undefined
    return [actionLabels[entry.action], actor?.full_name, actor?.email, subject?.full_name, subject?.email, entry.details.title, entry.details.status]
      .some(value => String(value || '').toLocaleLowerCase('pt-BR').includes(term))
  })
})

function personName(id: string | null) {
  if (!id) return 'Não informado'
  const person = people.value[id]
  return person?.full_name || person?.email || 'Perfil indisponível'
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value))
}

function detailSummary(entry: AuditEntry) {
  if (entry.entity_type === 'daily_message') {
    const title = typeof entry.details.title === 'string' ? entry.details.title : 'Sem título'
    const status = typeof entry.details.status === 'string' ? `Status: ${entry.details.status}.` : ''
    return `${title}. ${status}`.trim()
  }
  const previous = typeof entry.details.previous_status === 'string' ? entry.details.previous_status : '—'
  const current = typeof entry.details.status === 'string' ? entry.details.status : '—'
  return `Status: ${previous} → ${current}.`
}

async function loadAudit() {
  const { $supabase } = useNuxtApp()
  if (!$supabase) {
    errorMessage.value = 'O serviço de dados não está configurado neste ambiente.'
    loading.value = false
    return
  }

  loading.value = true
  errorMessage.value = ''
  const { data, error } = await $supabase
    .from('administrative_audit_log')
    .select('id, actor_id, action, entity_type, entity_id, subject_user_id, details, created_at')
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) {
    errorMessage.value = 'Não foi possível carregar a auditoria. Confirme se a migration administrativa já foi aplicada.'
    loading.value = false
    return
  }

  entries.value = data as AuditEntry[]
  const ids = [...new Set(entries.value.flatMap(entry => [entry.actor_id, entry.subject_user_id]).filter((id): id is string => Boolean(id)))]
  if (ids.length) {
    const { data: profiles } = await $supabase.from('profiles').select('id, full_name, email').in('id', ids)
    people.value = Object.fromEntries(((profiles || []) as ProfileName[]).map(person => [person.id, person]))
  } else {
    people.value = {}
  }
  loading.value = false
}

onMounted(loadAudit)
</script>

<template>
  <div>
    <PageIntro
      title="Auditoria administrativa"
      description="Histórico imutável das decisões de participação e alterações editoriais realizadas pela gestão."
      icon="i-lucide-scroll-text"
    />

    <BrandLoader
      v-if="loading"
      class="my-5"
      label="Carregando auditoria…"
    />

    <UAlert
      color="primary"
      variant="subtle"
      title="Registro de segurança"
      description="Os eventos são gravados pelo banco durante a ação administrativa. Não há edição ou exclusão de registros por esta tela."
    />

    <section
      class="mt-6"
      aria-labelledby="audit-history-title"
    >
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p class="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
            Histórico
          </p>
          <h2
            id="audit-history-title"
            class="mt-1 text-2xl font-bold"
          >
            Últimas ações
          </h2>
        </div>
        <div class="flex w-full gap-2 sm:w-auto">
          <UInput
            v-model="search"
            class="min-w-0 flex-1 sm:w-72"
            icon="i-lucide-search"
            placeholder="Buscar por pessoa ou ação"
          />
          <UButton
            color="neutral"
            variant="outline"
            icon="i-lucide-refresh-cw"
            :loading="loading"
            aria-label="Atualizar auditoria"
            @click="loadAudit"
          />
        </div>
      </div>

      <UAlert
        v-if="errorMessage"
        class="mt-5"
        color="warning"
        variant="subtle"
        :description="errorMessage"
      />

      <div
        v-else-if="loading"
        class="mt-5 space-y-3"
      >
        <USkeleton
          v-for="item in 4"
          :key="item"
          class="h-24 w-full"
        />
      </div>

      <UCard
        v-else-if="!visibleEntries.length"
        class="mt-5"
      >
        <div class="py-6 text-center">
          <UIcon
            name="i-lucide-clipboard-list"
            class="mx-auto size-8 text-muted"
          />
          <p class="mt-3 font-semibold">
            Nenhum registro encontrado
          </p>
          <p class="mt-1 text-sm text-muted">
            As próximas alterações de conteúdo e decisões de participação aparecerão aqui.
          </p>
        </div>
      </UCard>

      <div
        v-else
        class="mt-5 space-y-3"
      >
        <UCard
          v-for="entry in visibleEntries"
          :key="entry.id"
        >
          <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <UBadge
                  color="primary"
                  variant="subtle"
                  :label="actionLabels[entry.action]"
                />
                <span class="text-xs text-muted">{{ entry.entity_type === 'daily_message' ? 'Conteúdo' : 'Participação' }}</span>
              </div>
              <p class="mt-3 text-sm font-medium">
                {{ detailSummary(entry) }}
              </p>
              <p class="mt-1 text-sm text-muted">
                Por <span class="font-medium text-default">{{ personName(entry.actor_id) }}</span>
                <template v-if="entry.subject_user_id">
                  · relacionado a <span class="font-medium text-default">{{ personName(entry.subject_user_id) }}</span>
                </template>
              </p>
            </div>
            <time
              class="shrink-0 text-sm text-muted"
              :datetime="entry.created_at"
            >{{ formatDate(entry.created_at) }}</time>
          </div>
        </UCard>
      </div>
    </section>
  </div>
</template>
