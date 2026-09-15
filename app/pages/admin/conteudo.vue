<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: ['auth', 'admin'] })
useSeoMeta({ title: 'Conteúdo e avisos' })

type ContentType = 'word_of_day' | 'news'
type PublicationStatus = 'draft' | 'scheduled' | 'published' | 'archived'

interface EditorialContent {
  id: string
  title: string
  content: string
  content_type: ContentType
  slug: string | null
  message_date: string
  publish_at: string | null
  status: PublicationStatus
  created_at: string
  updated_at: string
}

const auth = useAuthStore()
const loading = ref(true)
const saving = ref(false)
const editorOpen = ref(false)
const editingId = ref<string | null>(null)
const feedback = ref('')
const errorMessage = ref('')
const contentItems = ref<EditorialContent[]>([])
const form = reactive({
  title: '',
  content: '',
  contentType: 'word_of_day' as ContentType,
  status: 'draft' as Exclude<PublicationStatus, 'archived'>,
  slug: '',
  messageDate: new Date().toISOString().slice(0, 10),
  publishAt: '',
  notifyMembers: true
})

const typeItems = [
  { label: 'Palavra do Dia', value: 'word_of_day' },
  { label: 'Notícia ou comunicado', value: 'news' }
]
const statusItems = [
  { label: 'Rascunho', value: 'draft' },
  { label: 'Publicar agora', value: 'published' },
  { label: 'Agendar publicação', value: 'scheduled' }
]
const typeLabels: Record<ContentType, string> = { word_of_day: 'Palavra do Dia', news: 'Notícia' }
const statusLabels: Record<PublicationStatus, string> = { draft: 'Rascunho', scheduled: 'Agendado', published: 'Publicado', archived: 'Arquivado' }

const metrics = computed(() => ({
  published: contentItems.value.filter(item => editorialStatus(item) === 'published').length,
  drafts: contentItems.value.filter(item => item.status === 'draft').length,
  scheduled: contentItems.value.filter(item => editorialStatus(item) === 'scheduled').length
}))

function formatDate(value: string | null) {
  if (!value) return 'Sem data definida'
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}

function editorialStatus(item: EditorialContent): PublicationStatus {
  if (item.status === 'published' && item.publish_at && new Date(item.publish_at).getTime() > Date.now()) return 'scheduled'
  return item.status
}

function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 96)
}

function resetForm() {
  editingId.value = null
  Object.assign(form, {
    title: '',
    content: '',
    contentType: 'word_of_day',
    status: 'draft',
    slug: '',
    messageDate: new Date().toISOString().slice(0, 10),
    publishAt: '',
    notifyMembers: true
  })
}

function openCreate() {
  resetForm()
  feedback.value = ''
  errorMessage.value = ''
  editorOpen.value = true
}

function editContent(item: EditorialContent) {
  editingId.value = item.id
  Object.assign(form, {
    title: item.title,
    content: item.content,
    contentType: item.content_type,
    status: editorialStatus(item) === 'archived' ? 'draft' : editorialStatus(item),
    slug: item.slug || '',
    messageDate: item.message_date,
    publishAt: item.publish_at ? item.publish_at.slice(0, 16) : '',
    notifyMembers: false
  })
  feedback.value = ''
  errorMessage.value = ''
  editorOpen.value = true
}

async function loadContent() {
  const { $supabase } = useNuxtApp()
  if (!$supabase) {
    errorMessage.value = 'O serviço de dados não está configurado neste ambiente.'
    loading.value = false
    return
  }

  loading.value = true
  const { data, error } = await $supabase
    .from('daily_messages')
    .select('id, title, content, content_type, slug, message_date, publish_at, status, created_at, updated_at')
    .order('updated_at', { ascending: false })
    .limit(100)
  if (error) errorMessage.value = 'Não foi possível carregar as publicações.'
  else contentItems.value = data as EditorialContent[]
  loading.value = false
}

async function notifyOptedInMembers(item: EditorialContent) {
  const { $supabase } = useNuxtApp()
  if (!$supabase) return { count: 0, error: null as Error | null }

  const { data: profiles, error: profilesError } = await $supabase
    .from('profiles')
    .select('id')
    .eq('notifications_enabled', true)
    .limit(1000)
  if (profilesError) return { count: 0, error: profilesError }
  if (!profiles?.length) return { count: 0, error: null }

  const deepLink = item.content_type === 'word_of_day' ? `/mensagens/${item.slug}` : `/noticias/${item.slug}`
  const { error } = await $supabase.from('notifications').insert(profiles.map(profile => ({
    user_id: profile.id,
    title: item.content_type === 'word_of_day' ? 'Nova Palavra do Dia' : 'Novo comunicado CEDA',
    body: item.title,
    deep_link: deepLink
  })))
  return { count: profiles.length, error }
}

async function saveContent() {
  if (!auth.profile || !form.title.trim() || !form.content.trim()) {
    errorMessage.value = 'Informe título e conteúdo antes de salvar.'
    return
  }
  if (form.status === 'scheduled' && !form.publishAt) {
    errorMessage.value = 'Defina data e horário para o agendamento.'
    return
  }
  const { $supabase } = useNuxtApp()
  if (!$supabase) return

  saving.value = true
  errorMessage.value = ''
  feedback.value = ''
  const slug = slugify(form.slug || form.title)
  if (!slug) {
    saving.value = false
    errorMessage.value = 'Informe um título que possa gerar um link válido.'
    return
  }
  const publishAt = form.status === 'published'
    ? new Date().toISOString()
    : form.status === 'scheduled' ? new Date(form.publishAt).toISOString() : null
  const payload = {
    title: form.title.trim(),
    content: form.content.trim(),
    content_type: form.contentType,
    slug,
    message_date: form.messageDate,
    status: form.status === 'scheduled' ? 'published' : form.status,
    publish_at: publishAt,
    updated_at: new Date().toISOString()
  }

  let item: EditorialContent | null = null
  if (editingId.value) {
    const { data, error } = await $supabase
      .from('daily_messages')
      .update(payload)
      .eq('id', editingId.value)
      .select('id, title, content, content_type, slug, message_date, publish_at, status, created_at, updated_at')
      .single()
    if (error) {
      saving.value = false
      errorMessage.value = error.code === '23505' ? 'Este link já está sendo usado por outra publicação.' : 'Não foi possível atualizar a publicação.'
      return
    }
    item = data as EditorialContent
  } else {
    const { data, error } = await $supabase
      .from('daily_messages')
      .insert({ ...payload, author_id: auth.profile.id })
      .select('id, title, content, content_type, slug, message_date, publish_at, status, created_at, updated_at')
      .single()
    if (error) {
      saving.value = false
      errorMessage.value = error.code === '23505' ? 'Este link já está sendo usado por outra publicação.' : 'Não foi possível criar a publicação.'
      return
    }
    item = data as EditorialContent
  }

  const historyResult = await $supabase.from('daily_message_history').insert({
    message_id: item.id,
    editor_id: auth.profile.id,
    snapshot: { ...payload, action: editingId.value ? 'updated' : 'created' }
  })
  if (historyResult.error) {
    saving.value = false
    errorMessage.value = 'A publicação foi salva, mas não foi possível registrar seu histórico.'
    await loadContent()
    return
  }

  let notificationCount = 0
  if (form.status === 'published' && form.notifyMembers) {
    const notificationResult = await notifyOptedInMembers(item)
    if (notificationResult.error) {
      saving.value = false
      errorMessage.value = 'A publicação foi salva, mas os avisos internos não puderam ser enviados.'
      await loadContent()
      return
    }
    notificationCount = notificationResult.count
  }

  saving.value = false
  editorOpen.value = false
  feedback.value = notificationCount
    ? `Publicação salva e ${notificationCount} membro(s) elegível(is) receberam o aviso interno.`
    : form.status === 'scheduled'
      ? 'Publicação agendada. O aviso poderá ser enviado quando ela for publicada.'
      : 'Publicação salva com sucesso.'
  await loadContent()
}

onMounted(loadContent)
</script>

<template>
  <div>
    <PageIntro
      title="Conteúdo e avisos"
      description="Planeje a Palavra do Dia, publique comunicados e envie avisos internos com respeito às preferências dos membros."
      icon="i-lucide-megaphone"
    />

    <UAlert
      color="primary"
      variant="subtle"
      title="Notificações com preferência respeitada"
      description="Ao publicar agora, os avisos internos são criados somente para quem manteve as notificações habilitadas no perfil. Agendamentos não enviam aviso antecipado."
    />

    <UAlert
      v-if="errorMessage || feedback"
      class="mt-5"
      :color="errorMessage ? 'error' : 'success'"
      variant="subtle"
      :title="errorMessage ? 'Não foi possível concluir' : 'Conteúdo atualizado'"
      :description="errorMessage || feedback"
    />

    <section class="mt-6 grid gap-4 sm:grid-cols-3">
      <UCard>
        <UIcon
          name="i-lucide-send"
          class="size-6 text-primary"
        />
        <p class="mt-4 text-3xl font-bold">
          {{ loading ? '—' : metrics.published }}
        </p>
        <p class="mt-1 text-sm text-muted">
          Publicações ativas
        </p>
      </UCard>
      <UCard>
        <UIcon
          name="i-lucide-file-pen-line"
          class="size-6 text-primary"
        />
        <p class="mt-4 text-3xl font-bold">
          {{ loading ? '—' : metrics.drafts }}
        </p>
        <p class="mt-1 text-sm text-muted">
          Rascunhos
        </p>
      </UCard>
      <UCard>
        <UIcon
          name="i-lucide-calendar-clock"
          class="size-6 text-primary"
        />
        <p class="mt-4 text-3xl font-bold">
          {{ loading ? '—' : metrics.scheduled }}
        </p>
        <p class="mt-1 text-sm text-muted">
          Agendadas
        </p>
      </UCard>
    </section>

    <section
      class="mt-8"
      aria-labelledby="content-title"
    >
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p class="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
            Editorial
          </p>
          <h2
            id="content-title"
            class="mt-1 text-2xl font-bold"
          >
            Publicações
          </h2>
        </div>
        <div class="flex gap-2">
          <UButton
            color="neutral"
            variant="outline"
            icon="i-lucide-refresh-cw"
            label="Atualizar"
            :loading="loading"
            @click="loadContent"
          />
          <UButton
            icon="i-lucide-plus"
            label="Nova publicação"
            @click="openCreate"
          />
        </div>
      </div>

      <div
        v-if="loading"
        class="mt-5 grid gap-4 lg:grid-cols-2"
      >
        <USkeleton
          v-for="index in 4"
          :key="index"
          class="h-52 rounded-xl"
        />
      </div>
      <div
        v-else-if="contentItems.length"
        class="mt-5 grid gap-4 lg:grid-cols-2"
      >
        <UCard
          v-for="item in contentItems"
          :key="item.id"
        >
          <div class="flex flex-wrap items-center gap-2">
            <UBadge
              color="neutral"
              variant="subtle"
              :label="typeLabels[item.content_type]"
            />
            <UBadge
              :color="editorialStatus(item) === 'published' ? 'primary' : editorialStatus(item) === 'scheduled' ? 'secondary' : 'neutral'"
              variant="subtle"
              :label="statusLabels[editorialStatus(item)]"
            />
          </div>
          <h3 class="mt-4 text-lg font-semibold">
            {{ item.title }}
          </h3>
          <p class="mt-2 line-clamp-3 whitespace-pre-line text-sm leading-6 text-muted">
            {{ item.content }}
          </p>
          <template #footer>
            <div class="flex flex-wrap items-center justify-between gap-3">
              <p class="text-xs text-muted">
                {{ editorialStatus(item) === 'scheduled' ? `Programada para ${formatDate(item.publish_at)}` : `Atualizada em ${formatDate(item.updated_at)}` }}
              </p>
              <UButton
                size="sm"
                color="neutral"
                variant="outline"
                icon="i-lucide-pencil"
                label="Editar"
                @click="editContent(item)"
              />
            </div>
          </template>
        </UCard>
      </div>
      <UCard
        v-else
        class="mt-5"
      >
        <div class="py-8 text-center">
          <UIcon
            name="i-lucide-file-plus-2"
            class="mx-auto size-10 text-muted"
          />
          <h3 class="mt-3 font-semibold">
            Nenhuma publicação criada
          </h3>
          <p class="mt-1 text-sm text-muted">
            Crie o primeiro rascunho ou comunicado da CEDA.
          </p>
          <UButton
            class="mt-5"
            label="Criar publicação"
            @click="openCreate"
          />
        </div>
      </UCard>
    </section>

    <UModal
      v-model:open="editorOpen"
      :title="editingId ? 'Editar publicação' : 'Nova publicação'"
      :description="'Rascunhos ficam visíveis apenas à gestão. Publicações seguem as permissões do banco.'"
    >
      <template #body>
        <form
          class="grid gap-4"
          @submit.prevent="saveContent"
        >
          <div class="grid gap-4 sm:grid-cols-2">
            <UFormField
              label="Tipo"
              required
            >
              <USelect
                v-model="form.contentType"
                :items="typeItems"
                class="w-full"
              />
            </UFormField>
            <UFormField
              label="Status"
              required
            >
              <USelect
                v-model="form.status"
                :items="statusItems"
                class="w-full"
              />
            </UFormField>
          </div>
          <UFormField
            label="Título"
            required
          >
            <UInput
              v-model="form.title"
              class="w-full"
              placeholder="Ex.: Encontro especial neste domingo"
            />
          </UFormField>
          <UFormField
            label="Link da publicação"
            hint="Gerado a partir do título; personalize se necessário."
            required
          >
            <UInput
              v-model="form.slug"
              class="w-full"
              placeholder="encontro-especial-neste-domingo"
            />
          </UFormField>
          <UFormField
            label="Data editorial"
            required
          >
            <UInput
              v-model="form.messageDate"
              type="date"
              class="w-full"
            />
          </UFormField>
          <UFormField
            v-if="form.status === 'scheduled'"
            label="Data e horário de publicação"
            required
          >
            <UInput
              v-model="form.publishAt"
              type="datetime-local"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="Conteúdo"
            required
            hint="Use parágrafos separados por uma linha em branco."
          >
            <UTextarea
              v-model="form.content"
              :rows="9"
              class="w-full"
            />
          </UFormField>
          <UCheckbox
            v-if="form.status === 'published'"
            v-model="form.notifyMembers"
            label="Criar aviso interno para membros com notificações habilitadas"
          />
          <div class="flex flex-wrap justify-end gap-2 pt-2">
            <UButton
              type="button"
              color="neutral"
              variant="outline"
              label="Cancelar"
              @click="editorOpen = false"
            />
            <UButton
              type="submit"
              :loading="saving"
              :label="form.status === 'published' ? 'Publicar' : form.status === 'scheduled' ? 'Agendar' : 'Salvar rascunho'"
            />
          </div>
        </form>
      </template>
    </UModal>
  </div>
</template>
