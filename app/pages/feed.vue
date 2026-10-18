<script setup lang="ts">
import type { FormError } from '@nuxt/ui'

definePageMeta({ middleware: 'auth' })
useSeoMeta({ title: 'Conversas da comunidade' })
const auth = useAuthStore()
const route = useRoute()
const feed = useCommunityFeed()
const composerOpen = ref(false)
const commentsOpen = ref(false)
const draft = reactive({ title: '', description: '' })
const commentForm = reactive({ content: '' })
const commentDrafts = reactive<Record<string, string>>({})
const dirty = computed(() => Boolean(draft.title.trim() || draft.description.trim() || Object.values(commentDrafts).some(text => text.trim())))
const shareError = ref('')
const toast = useToast()
const authorName = (id: string, name?: string) => id === auth.profile?.id ? 'Você' : name || 'Membro da CEDA'
const dateLabel = (date: string) => new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(date))
function validatePost(state: typeof draft): FormError[] {
  const errors: FormError[] = []
  if (!state.title.trim() || state.title.trim().length > 160) errors.push({ name: 'title', message: 'Escreva um título de até 160 caracteres.' })
  if (!state.description.trim() || state.description.trim().length > 5000) errors.push({ name: 'description', message: 'Escreva sua publicação com até 5.000 caracteres.' })
  return errors
}
async function publish() {
  const title = draft.title
  const description = draft.description
  if (await feed.publish(title, description)) {
    if (draft.title === title && draft.description === description) {
      composerOpen.value = false
      draft.title = ''
      draft.description = ''
    }
    toast.add({ title: 'Publicação enviada', description: 'Sua publicação já aparece para os membros.', color: 'success' })
  }
}
function openComments(postId: string) {
  commentsOpen.value = true
  void feed.loadComments(postId)
  commentForm.content = commentDrafts[postId] || ''
}
async function sendComment() {
  if (!commentForm.content.trim() || commentForm.content.trim().length > 2000) return
  const postId = feed.selectedId.value
  const content = commentForm.content
  if (await feed.comment(content)) {
    if (feed.selectedId.value === postId && commentForm.content === content) commentForm.content = ''
    if (commentDrafts[postId] === content || !commentDrafts[postId]?.trim()) Reflect.deleteProperty(commentDrafts, postId)
  }
}
watch(() => commentForm.content, (content) => {
  if (feed.selectedId.value) commentDrafts[feed.selectedId.value] = content
}, { flush: 'sync' })
watch(() => auth.profile?.id, () => {
  draft.title = ''
  draft.description = ''
  commentForm.content = ''
  for (const id of Object.keys(commentDrafts)) Reflect.deleteProperty(commentDrafts, id)
  composerOpen.value = false
  commentsOpen.value = false
  shareError.value = ''
}, { flush: 'sync' })
async function loadFeed() {
  const targetId = /^#publicacao-([0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12})$/i.exec(route.hash)?.[1]?.toLowerCase()
  await feed.load(false, targetId)
  if (targetId) {
    await nextTick()
    document.getElementById(`publicacao-${targetId}`)?.scrollIntoView({ block: 'start' })
  }
}
async function sharePost(post: { id: string, title: string, description: string }) {
  shareError.value = ''
  try {
    const url = `${window.location.origin}/feed#publicacao-${post.id}`
    if (navigator.share) await navigator.share({ title: post.title, text: post.description.slice(0, 280), url })
    else {
      await navigator.clipboard.writeText(url)
      toast.add({ title: 'Link copiado', description: 'A publicação fica disponível para quem tem acesso à área de membros.', color: 'success' })
    }
  } catch (error) {
    if (!(error instanceof DOMException && error.name === 'AbortError')) shareError.value = 'Não foi possível compartilhar. Tente novamente.'
  }
}
onMounted(loadFeed)
watch(() => route.hash, loadFeed)
</script>

<template>
  <div>
    <AppUnsavedChanges :dirty="dirty" />
    <PageIntro
      title="Conversas da comunidade"
      description="Compartilhe histórias e converse com outros membros. Para pedidos pessoais, use o espaço privado de oração."
      icon="i-lucide-messages-square"
    />
    <div class="mb-5 flex flex-wrap gap-3">
      <UButton
        label="Nova publicação"
        icon="i-lucide-square-pen"
        @click="composerOpen = !composerOpen"
      />
      <UButton
        label="Atualizar"
        icon="i-lucide-refresh-cw"
        color="neutral"
        variant="outline"
        :loading="feed.loading.value"
        :disabled="Boolean(feed.busy.value)"
        @click="loadFeed"
      />
      <UButton
        to="/oracao"
        label="Pedido de oração privado"
        color="neutral"
        variant="ghost"
      />
    </div>
    <UAlert
      v-if="feed.errorMessage.value || shareError"
      class="mb-5"
      color="error"
      :description="feed.errorMessage.value || shareError"
      :actions="[{ label: 'Atualizar conversas', onClick: loadFeed }]"
    />
    <UCard
      v-if="composerOpen"
      class="mb-6"
    >
      <h2 class="text-lg font-semibold">
        Nova publicação
      </h2>
      <p class="mt-1 text-sm text-muted">
        Visível para todos os membros da CEDA. Evite informações pessoais e pedidos sensíveis.
      </p>
      <UForm
        :state="draft"
        :validate="validatePost"
        class="mt-4 space-y-4"
        @submit="publish"
      >
        <UFormField
          name="title"
          label="Título"
          required
        >
          <UInput
            v-model="draft.title"
            class="w-full"
            :maxlength="160"
            :disabled="feed.busy.value === 'publish'"
          />
        </UFormField>
        <UFormField
          name="description"
          label="O que você quer compartilhar?"
          required
        >
          <UTextarea
            v-model="draft.description"
            class="w-full"
            :rows="5"
            :maxlength="5000"
            :disabled="feed.busy.value === 'publish'"
          />
        </UFormField>
        <div class="flex flex-wrap gap-3">
          <UButton
            type="submit"
            label="Publicar para os membros"
            :loading="feed.busy.value === 'publish'"
            :disabled="Boolean(feed.busy.value)"
          />
          <UButton
            label="Continuar depois"
            color="neutral"
            variant="outline"
            @click="composerOpen = false"
          />
        </div>
        <p class="text-xs text-muted">
          Seu texto é mantido ao fechar este formulário enquanto você permanece nesta página.
        </p>
      </UForm>
    </UCard>
    <div
      v-if="feed.loading.value && !feed.posts.value.length"
      class="space-y-4"
      aria-busy="true"
      aria-label="Carregando conversas"
    >
      <USkeleton
        v-for="n in 3"
        :key="n"
        class="h-64 w-full rounded-xl"
      />
    </div>
    <UCard
      v-else-if="!feed.posts.value.length && !feed.errorMessage.value"
      class="py-6 text-center"
    >
      <UIcon
        name="i-lucide-messages-square"
        class="size-10 text-primary"
      />
      <h2 class="mt-3 font-semibold">
        A conversa começa com a comunidade
      </h2>
      <p class="mt-2 text-sm text-muted">
        As publicações dos membros aparecerão aqui. Você pode compartilhar a primeira história.
      </p>
      <UButton
        class="mt-5"
        label="Escrever uma publicação"
        @click="composerOpen = true"
      />
    </UCard>
    <div class="space-y-5">
      <UCard
        v-for="post in feed.posts.value"
        :id="`publicacao-${post.id}`"
        :key="post.id"
        class="scroll-mt-24"
      >
        <template #header>
          <div class="flex items-center gap-3">
            <UAvatar icon="i-lucide-user-round" />
            <div>
              <p class="font-medium">
                {{ authorName(post.author_id, post.author?.full_name) }}
              </p><time
                :datetime="post.created_at"
                class="text-xs text-muted"
              >{{ dateLabel(post.created_at) }}</time>
            </div>
          </div>
        </template>
        <h2 class="break-words text-xl font-semibold">
          {{ post.title }}
        </h2>
        <p class="mt-3 whitespace-pre-line break-words leading-7 text-muted">
          {{ post.description }}
        </p>
        <p class="mt-4 text-sm text-muted">
          {{ post.likes[0]?.count || 0 }} curtidas · {{ post.comments[0]?.count || 0 }} comentários
        </p>
        <template #footer>
          <div class="flex flex-wrap gap-2">
            <UButton
              :label="feed.likedIds.value.includes(post.id) ? 'Curtido' : 'Curtir'"
              icon="i-lucide-heart"
              :variant="feed.likedIds.value.includes(post.id) ? 'soft' : 'ghost'"
              :aria-pressed="feed.likedIds.value.includes(post.id)"
              :loading="feed.busy.value === post.id"
              :disabled="Boolean(feed.busy.value)"
              @click="feed.toggleLike(post)"
            />
            <UButton
              label="Comentar"
              icon="i-lucide-message-circle"
              color="neutral"
              variant="ghost"
              @click="openComments(post.id)"
            />
            <UButton
              label="Compartilhar"
              icon="i-lucide-share-2"
              color="neutral"
              variant="ghost"
              @click="sharePost(post)"
            />
          </div>
        </template>
      </UCard>
    </div>
    <UButton
      v-if="feed.hasMore.value"
      class="mt-5"
      block
      color="neutral"
      variant="outline"
      label="Ver mais publicações"
      :loading="feed.loading.value"
      @click="feed.load(true)"
    />
    <UModal
      v-model:open="commentsOpen"
      title="Comentários"
      description="Converse com respeito. Os comentários são visíveis para os membros com acesso à publicação."
    >
      <template #body>
        <UAlert
          v-if="feed.commentsError.value"
          class="mb-4"
          color="error"
          :description="feed.commentsError.value"
          :actions="[{ label: 'Tentar novamente', onClick: () => feed.loadComments(feed.selectedId.value) }]"
        />
        <USkeleton
          v-if="feed.commentsLoading.value"
          class="h-40 w-full rounded-xl"
        />
        <template v-else>
          <p
            v-if="!feed.comments.value.length && !feed.commentsError.value"
            class="py-5 text-sm text-muted"
          >
            Ainda não há comentários. Você pode iniciar a conversa.
          </p>
          <p
            v-else
            class="mb-3 text-xs text-muted"
          >
            Até 50 comentários mais recentes, do mais novo para o mais antigo.
          </p>
          <div class="max-h-80 space-y-3 overflow-y-auto">
            <div
              v-for="item in feed.comments.value"
              :key="item.id"
              class="rounded-xl bg-elevated p-4"
            >
              <p class="text-sm font-medium">
                {{ authorName(item.author_id, item.author?.full_name) }}
              </p>
              <time
                :datetime="item.created_at"
                class="text-xs text-muted"
              >{{ dateLabel(item.created_at) }}</time>
              <p class="mt-2 whitespace-pre-line break-words text-sm leading-6">
                {{ item.content }}
              </p>
            </div>
          </div>
        </template>
        <UForm
          :state="commentForm"
          class="mt-5 space-y-3"
          @submit="sendComment"
        >
          <UFormField
            label="Seu comentário"
            name="content"
            hint="Até 2.000 caracteres"
          >
            <UTextarea
              v-model="commentForm.content"
              :rows="3"
              :maxlength="2000"
              class="w-full"
              :disabled="feed.busy.value === 'comment'"
            />
          </UFormField>
          <UButton
            type="submit"
            block
            label="Enviar comentário"
            icon="i-lucide-send"
            :loading="feed.busy.value === 'comment'"
            :disabled="!commentForm.content.trim() || Boolean(feed.busy.value) || feed.commentsLoading.value"
          />
          <p class="text-xs text-muted">
            Seu comentário é mantido ao fechar esta janela enquanto você permanece nesta página.
          </p>
        </UForm>
      </template>
    </UModal>
  </div>
</template>
