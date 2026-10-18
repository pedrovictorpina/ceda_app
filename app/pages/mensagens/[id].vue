<script setup lang="ts">
import type { PublishedEditorialItem } from '~/composables/usePublishedEditorial'
import { editorialPreview } from '~/utils/editorial'
import { formatEditorialDate } from '~/utils/churchAgenda'

definePageMeta({ middleware: 'auth' })
const route = useRoute()
const { bySlug, loading, errorMessage } = usePublishedEditorial()
const message = ref<PublishedEditorialItem | null>(null)
const currentMessage = computed(() => message.value ? editorialPreview(message.value) : null)
const savedMessages = useSavedMessages()
const copied = ref(false)
const shareError = ref('')
useSeoMeta({ title: () => currentMessage.value?.title || 'Mensagem', description: () => currentMessage.value?.excerpt || '' })
async function load() {
  message.value = await bySlug('word_of_day', String(route.params.id))
}
onMounted(() => {
  void load()
  void savedMessages.load()
})
watch(() => route.params.id, load)
async function shareMessage() {
  if (!currentMessage.value) return
  shareError.value = ''
  try {
    const payload = { title: currentMessage.value.title, text: currentMessage.value.excerpt, url: window.location.href }
    if (navigator.share) await navigator.share(payload)
    else {
      await navigator.clipboard.writeText(window.location.href)
      copied.value = true
    }
  } catch (error) {
    if (!(error instanceof Error && error.name === 'AbortError')) shareError.value = 'Não foi possível compartilhar. Você pode copiar o endereço desta página.'
  }
}
</script>

<template>
  <div class="mx-auto max-w-3xl pb-10">
    <UButton
      to="/palavra-do-dia"
      color="neutral"
      variant="link"
      icon="i-lucide-arrow-left"
      label="Voltar para Palavra do Dia"
      class="mb-6"
    />
    <div
      v-if="loading"
      class="py-12 text-center text-muted"
      role="status"
    >
      Carregando a mensagem…
    </div>
    <UAlert
      v-else-if="errorMessage"
      color="error"
      variant="soft"
      title="Mensagem indisponível"
      :description="errorMessage"
      :actions="[{ label: 'Tentar novamente', onClick: load }]"
    />
    <article v-else-if="currentMessage">
      <div class="rounded-2xl border border-default bg-primary/5 p-6 sm:p-10">
        <UBadge label="Palavra do Dia" />
        <p class="mt-4 text-sm text-muted">
          {{ formatEditorialDate(currentMessage.message_date) }} · {{ currentMessage.readTime }}
        </p>
        <h1 class="mt-3 break-words text-3xl font-black tracking-tight sm:text-5xl">
          {{ currentMessage.title }}
        </h1>
        <p class="mt-5 whitespace-pre-line text-xl leading-8 text-muted">
          {{ currentMessage.excerpt }}
        </p>
      </div>
      <div class="mt-8 space-y-6 text-lg leading-8">
        <p
          v-for="(paragraph, index) in currentMessage.body"
          :key="index"
          class="whitespace-pre-line"
        >
          {{ paragraph }}
        </p>
      </div>
      <div class="mt-10 flex flex-wrap gap-3 border-t border-default pt-6">
        <UButton
          color="neutral"
          variant="outline"
          :icon="copied ? 'i-lucide-check' : 'i-lucide-share-2'"
          :label="copied ? 'Link copiado' : 'Compartilhar mensagem'"
          @click="shareMessage"
        />
        <UButton
          color="neutral"
          :disabled="savedMessages.loading.value || savedMessages.saving.value"
          :loading="savedMessages.saving.value"
          :variant="savedMessages.isSaved(currentMessage.slug) ? 'soft' : 'outline'"
          :label="savedMessages.isSaved(currentMessage.slug) ? 'Remover dos salvos' : 'Salvar para depois'"
          icon="i-lucide-bookmark"
          @click="savedMessages.toggle(currentMessage.slug)"
        />
        <UButton
          to="/salvos"
          variant="link"
          label="Ver mensagens salvas"
        />
      </div>
      <UAlert
        v-if="savedMessages.errorMessage.value || shareError"
        class="mt-4"
        color="error"
        variant="soft"
        title="Não foi possível concluir a ação"
        :description="savedMessages.errorMessage.value || shareError"
      />
    </article>
    <UCard
      v-else
      class="py-10 text-center"
    >
      <UIcon
        name="i-lucide-file-question-mark"
        class="size-12 text-muted"
      /><h1 class="mt-4 text-2xl font-bold">
        Mensagem não encontrada
      </h1>
      <p class="mt-2 text-muted">
        O conteúdo pode ter sido removido ou ainda não está publicado.
      </p>
      <UButton
        class="mt-6"
        to="/palavra-do-dia"
        label="Ver a mensagem mais recente"
      />
    </UCard>
  </div>
</template>
