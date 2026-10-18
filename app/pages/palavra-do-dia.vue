<script setup lang="ts">
import type { PublishedEditorialItem } from '~/composables/usePublishedEditorial'
import { editorialPreview } from '~/utils/editorial'
import { formatEditorialDate } from '~/utils/churchAgenda'

definePageMeta({ middleware: 'auth' })
useSeoMeta({ title: 'Palavra do Dia' })
const { latest, loading, errorMessage } = usePublishedEditorial()
const message = ref<PublishedEditorialItem | null>(null)
const currentMessage = computed(() => message.value ? editorialPreview(message.value) : null)
const savedMessages = useSavedMessages()
async function load() {
  message.value = await latest('word_of_day')
}
onMounted(() => {
  void load()
  void savedMessages.load()
})
</script>

<template>
  <div>
    <PageIntro
      title="Palavra do Dia"
      description="Uma pausa na rotina para ler, refletir e seguir o dia com propósito."
      icon="i-lucide-book-open-text"
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
    <UCard
      v-else-if="currentMessage"
      class="relative max-w-4xl overflow-hidden border-primary/20"
    >
      <div class="relative p-1 sm:p-4">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <UBadge label="Palavra do Dia" /><span class="text-sm text-muted">{{ formatEditorialDate(currentMessage.message_date) }}</span>
        </div>
        <p class="mt-5 text-sm text-muted">
          {{ currentMessage.readTime }}
        </p>
        <h2 class="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
          {{ currentMessage.title }}
        </h2>
        <p class="mt-5 whitespace-pre-line text-lg leading-8 text-muted">
          {{ currentMessage.excerpt }}
        </p>
        <div class="mt-8 flex flex-wrap items-center gap-3">
          <UButton
            :to="`/mensagens/${currentMessage.slug}`"
            label="Ler mensagem completa"
            trailing-icon="i-lucide-arrow-right"
          />
          <UButton
            color="neutral"
            :disabled="savedMessages.loading.value || savedMessages.saving.value"
            :loading="savedMessages.saving.value"
            :variant="savedMessages.isSaved(currentMessage.slug) ? 'soft' : 'outline'"
            :icon="savedMessages.isSaved(currentMessage.slug) ? 'i-lucide-bookmark-check' : 'i-lucide-bookmark'"
            :label="savedMessages.isSaved(currentMessage.slug) ? 'Remover dos salvos' : 'Salvar para depois'"
            @click="savedMessages.toggle(currentMessage.slug)"
          />
          <UButton
            to="/salvos"
            variant="link"
            label="Ver mensagens salvas"
          />
        </div>
        <UAlert
          v-if="savedMessages.errorMessage.value"
          class="mt-4"
          color="error"
          variant="soft"
          title="Mensagens salvas"
          :description="savedMessages.errorMessage.value"
          :actions="[{ label: 'Tentar novamente', onClick: savedMessages.load }]"
        />
      </div>
    </UCard>
    <UCard
      v-else
      class="max-w-4xl py-8 text-center"
    >
      <UIcon
        name="i-lucide-book-open"
        class="size-9 text-muted"
      /><h2 class="mt-3 text-xl font-semibold">
        Ainda não há mensagem publicada
      </h2>
      <p class="mt-2 text-muted">
        Assim que uma mensagem for publicada pela equipe, ela aparecerá aqui.
      </p>
      <UButton
        class="mt-5"
        to="/noticias"
        color="neutral"
        variant="outline"
        label="Ver comunicados"
      />
    </UCard>
  </div>
</template>
