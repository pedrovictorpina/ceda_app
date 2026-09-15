<script setup lang="ts">
import { newsItems } from '~/data/contentCatalog'

definePageMeta({ middleware: 'auth' })
useSeoMeta({ title: 'Notícias' })

const query = ref('')
const publishedNews = ref<Array<{ slug: string, category: string, title: string, excerpt: string, date: string, icon: string }>>([])
const visibleNews = computed(() => publishedNews.value.length ? publishedNews.value : newsItems)
const filteredNews = computed(() => {
  const term = query.value.trim().toLocaleLowerCase('pt-BR')
  if (!term) return visibleNews.value
  return visibleNews.value.filter(item => `${item.title} ${item.excerpt} ${item.category}`.toLocaleLowerCase('pt-BR').includes(term))
})

onMounted(async () => {
  const items = await usePublishedEditorial().list('news')
  publishedNews.value = items.map(item => ({
    slug: item.slug,
    category: 'Comunicado',
    title: item.title,
    excerpt: item.content.split(/\n\s*\n/)[0] || item.content,
    date: new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(item.message_date)),
    icon: 'i-lucide-megaphone'
  }))
})
</script>

<template>
  <div>
    <PageIntro
      title="Notícias"
      description="Comunicados, histórias e informações importantes da comunidade."
      icon="i-lucide-newspaper"
    />
    <div class="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
      <p class="text-sm text-muted">
        {{ filteredNews.length }} publicações para acompanhar
      </p>
      <UInput
        v-model="query"
        icon="i-lucide-search"
        placeholder="Buscar notícias"
        class="w-full sm:w-80"
      />
    </div>
    <div
      v-if="filteredNews.length"
      class="grid gap-5 md:grid-cols-2 xl:grid-cols-3"
    >
      <UCard
        v-for="item in filteredNews"
        :key="item.slug"
        class="group"
      >
        <div class="grid aspect-[16/8] place-items-center rounded-xl bg-gradient-to-br from-primary/15 to-elevated">
          <UIcon
            :name="item.icon"
            class="size-12 text-primary transition-transform group-hover:scale-110"
          />
        </div>
        <div class="mt-5 flex items-center justify-between gap-3">
          <UBadge
            color="neutral"
            variant="subtle"
            :label="item.category"
          /><span class="text-xs text-muted">{{ item.date }}</span>
        </div>
        <h2 class="mt-4 text-xl font-bold">
          {{ item.title }}
        </h2>
        <p class="mt-2 text-sm leading-6 text-muted">
          {{ item.excerpt }}
        </p>
        <template #footer>
          <UButton
            :to="`/noticias/${item.slug}`"
            variant="link"
            class="px-0"
            label="Ler notícia"
            trailing-icon="i-lucide-arrow-right"
          />
        </template>
      </UCard>
    </div>
    <div
      v-else
      class="rounded-xl border border-dashed border-default py-12 text-center"
    >
      <UIcon
        name="i-lucide-search-x"
        class="mx-auto size-9 text-muted"
      /><h2 class="mt-3 font-semibold">
        Nenhuma notícia encontrada
      </h2><UButton
        class="mt-4"
        color="neutral"
        variant="outline"
        label="Limpar busca"
        @click="query = ''"
      />
    </div>
  </div>
</template>
