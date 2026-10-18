<script setup lang="ts">
import type { PublishedEditorialItem } from '~/composables/usePublishedEditorial'
import { editorialPreview } from '~/utils/editorial'
import { formatEditorialDate } from '~/utils/churchAgenda'

definePageMeta({ middleware: 'auth' })
const route = useRoute()
const { bySlug, loading, errorMessage } = usePublishedEditorial()
const publishedItem = ref<PublishedEditorialItem | null>(null)
const item = computed(() => publishedItem.value ? editorialPreview(publishedItem.value) : null)
useSeoMeta({ title: () => item.value?.title || 'Notícia' })
async function load() {
  publishedItem.value = await bySlug('news', String(route.params.id))
}
onMounted(load)
watch(() => route.params.id, load)
</script>

<template>
  <div class="mx-auto max-w-3xl pb-10">
    <UButton
      to="/noticias"
      color="neutral"
      variant="link"
      icon="i-lucide-arrow-left"
      label="Voltar para notícias"
      class="mb-6"
    />
    <div
      v-if="loading"
      class="py-12 text-center text-muted"
      role="status"
    >
      Carregando a notícia…
    </div>
    <UAlert
      v-else-if="errorMessage"
      color="error"
      variant="soft"
      title="Notícia indisponível"
      :description="errorMessage"
      :actions="[{ label: 'Tentar novamente', onClick: load }]"
    />
    <article v-else-if="item">
      <div class="flex flex-wrap items-center gap-3">
        <UBadge
          color="neutral"
          variant="subtle"
          label="Comunicado"
        /><span class="text-sm text-muted">{{ formatEditorialDate(item.message_date) }}</span>
      </div>
      <h1 class="mt-4 break-words text-3xl font-black tracking-tight sm:text-4xl">
        {{ item.title }}
      </h1>
      <p class="mt-5 whitespace-pre-line text-xl leading-8 text-muted">
        {{ item.excerpt }}
      </p>
      <div class="mt-8 space-y-5 text-lg leading-8">
        <p
          v-for="(paragraph, index) in item.body"
          :key="index"
          class="whitespace-pre-line"
        >
          {{ paragraph }}
        </p>
      </div>
      <div class="mt-10 rounded-xl bg-elevated p-5">
        <h2 class="font-semibold">
          Participe dos próximos encontros
        </h2><p class="mt-2 text-sm text-muted">
          Confira as datas e os locais publicados pela CEDA.
        </p><UButton
          class="mt-4"
          to="/eventos"
          label="Abrir agenda"
          trailing-icon="i-lucide-arrow-right"
        />
      </div>
    </article>
    <UCard
      v-else
      class="py-10 text-center"
    >
      <UIcon
        name="i-lucide-newspaper"
        class="size-12 text-muted"
      /><h1 class="mt-4 text-2xl font-bold">
        Notícia não encontrada
      </h1><p class="mt-2 text-muted">
        O conteúdo pode ter sido removido ou ainda não está publicado.
      </p><UButton
        class="mt-6"
        to="/noticias"
        label="Ver todas as notícias"
      />
    </UCard>
  </div>
</template>
