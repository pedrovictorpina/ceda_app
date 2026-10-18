<script setup lang="ts">
import type { PublishedEditorialItem } from '~/composables/usePublishedEditorial'
import { editorialPreview } from '~/utils/editorial'
import { formatEditorialDate } from '~/utils/churchAgenda'

definePageMeta({ middleware: 'auth' })
useSeoMeta({ title: 'Notícias' })
const query = ref('')
const { list, loading, errorMessage } = usePublishedEditorial()
const items = ref<PublishedEditorialItem[]>([])
const filteredNews = computed(() => {
  const term = query.value.trim().toLocaleLowerCase('pt-BR')
  return items.value.map(editorialPreview).filter(item => !term || `${item.title} ${item.content}`.toLocaleLowerCase('pt-BR').includes(term))
})
async function load() {
  items.value = await list('news')
}
onMounted(load)
</script>

<template>
  <div>
    <PageIntro
      title="Notícias"
      description="Comunicados, histórias e informações importantes da comunidade."
      icon="i-lucide-newspaper"
    />
    <div class="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
      <p
        class="text-sm text-muted"
        aria-live="polite"
      >
        {{ loading ? 'Buscando publicações…' : `${filteredNews.length} publicação(ões) encontrada(s)` }}
      </p>
      <UInput
        v-model="query"
        icon="i-lucide-search"
        placeholder="Buscar notícias"
        aria-label="Buscar notícias por título ou conteúdo"
        class="w-full sm:w-80"
      />
    </div>
    <div
      v-if="loading"
      class="py-12 text-center text-muted"
      role="status"
    >
      Carregando as notícias…
    </div>
    <UAlert
      v-else-if="errorMessage"
      color="error"
      variant="soft"
      title="Notícias indisponíveis"
      :description="errorMessage"
      :actions="[{ label: 'Tentar novamente', onClick: load }]"
    />
    <div
      v-else-if="filteredNews.length"
      class="grid gap-5 md:grid-cols-2 xl:grid-cols-3"
    >
      <UCard
        v-for="item in filteredNews"
        :key="item.slug"
      >
        <div class="flex flex-wrap items-center justify-between gap-3">
          <UBadge
            color="neutral"
            variant="subtle"
            label="Comunicado"
          /><span class="text-xs text-muted">{{ formatEditorialDate(item.message_date) }}</span>
        </div>
        <h2 class="mt-4 break-words text-xl font-bold">
          {{ item.title }}
        </h2>
        <p class="mt-3 line-clamp-4 whitespace-pre-line text-sm leading-6 text-muted">
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
    <UCard
      v-else
      class="py-8 text-center"
    >
      <UIcon
        :name="query ? 'i-lucide-search-x' : 'i-lucide-newspaper'"
        class="size-9 text-muted"
      />
      <h2 class="mt-3 font-semibold">
        {{ query ? 'Nenhuma notícia encontrada nesta busca' : 'Ainda não há notícias publicadas' }}
      </h2>
      <p class="mt-2 text-sm text-muted">
        {{ query ? 'Tente outras palavras ou consulte todas as notícias.' : 'Os próximos comunicados da equipe aparecerão aqui.' }}
      </p>
      <UButton
        v-if="query"
        class="mt-4"
        color="neutral"
        variant="outline"
        label="Limpar busca"
        @click="query = ''"
      />
    </UCard>
  </div>
</template>
