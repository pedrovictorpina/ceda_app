<script setup lang="ts">
import { newsItems } from '~/data/contentCatalog'
import type { PublishedEditorialItem } from '~/composables/usePublishedEditorial'

definePageMeta({ middleware: 'auth' })
const route = useRoute()
const publishedItem = ref<PublishedEditorialItem | null>(null)
const fallbackItem = computed(() => newsItems.find(entry => entry.slug === route.params.id))
const item = computed(() => publishedItem.value
  ? {
      title: publishedItem.value.title,
      excerpt: publishedItem.value.content.split(/\n\s*\n/)[0] || publishedItem.value.content,
      body: publishedItem.value.content.split(/\n\s*\n/).filter(Boolean),
      category: 'Comunicado',
      date: new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(publishedItem.value.message_date)),
      icon: 'i-lucide-megaphone'
    }
  : fallbackItem.value ? { ...fallbackItem.value, body: [] as string[] } : null)
useSeoMeta({ title: () => item.value?.title || 'Notícia' })

onMounted(async () => {
  publishedItem.value = await usePublishedEditorial().bySlug('news', String(route.params.id))
})
</script>

<template>
  <article
    v-if="item"
    class="mx-auto max-w-3xl pb-10"
  >
    <NuxtLink
      to="/noticias"
      class="focus-ring inline-flex items-center gap-2 rounded text-sm font-medium text-primary"
    ><UIcon name="i-lucide-arrow-left" />Voltar para notícias</NuxtLink>
    <div class="mt-6 grid aspect-[16/7] place-items-center rounded-2xl bg-gradient-to-br from-primary/15 to-elevated">
      <UIcon
        :name="item.icon"
        class="size-16 text-primary"
      />
    </div>
    <div class="mt-7 flex items-center gap-3">
      <UBadge
        color="neutral"
        variant="subtle"
        :label="item.category"
      /><span class="text-sm text-muted">{{ item.date }}</span>
    </div>
    <h1 class="mt-4 text-4xl font-black tracking-tight">
      {{ item.title }}
    </h1>
    <p class="mt-5 text-xl leading-8 text-muted">
      {{ item.excerpt }}
    </p>
    <div class="mt-8 space-y-5 text-lg leading-8">
      <template v-if="item.body.length">
        <p
          v-for="paragraph in item.body"
          :key="paragraph"
        >
          {{ paragraph }}
        </p>
      </template>
      <template v-else>
        <p>Esta publicação reúne as principais informações para que você acompanhe a vida da comunidade e participe com tranquilidade.</p>
        <p>Consulte a agenda do aplicativo para conferir horários e detalhes atualizados. Em caso de dúvida, use os canais oficiais antes de se deslocar.</p>
      </template>
    </div>
    <div class="mt-10 rounded-xl bg-elevated p-5">
      <h2 class="font-semibold">
        Próximo passo
      </h2><p class="mt-2 text-sm text-muted">
        Veja todas as atividades previstas e escolha onde deseja participar.
      </p><UButton
        class="mt-4"
        to="/eventos"
        size="sm"
        label="Abrir agenda"
        trailing-icon="i-lucide-arrow-right"
      />
    </div>
  </article>
  <div
    v-else
    class="mx-auto max-w-xl py-16 text-center"
  >
    <UIcon
      name="i-lucide-newspaper"
      class="mx-auto size-12 text-muted"
    /><h1 class="mt-4 text-2xl font-bold">
      Notícia não encontrada
    </h1><p class="mt-2 text-muted">
      O conteúdo pode ter sido removido ou ainda não está disponível.
    </p><UButton
      class="mt-6"
      to="/noticias"
      label="Ver todas as notícias"
    />
  </div>
</template>
