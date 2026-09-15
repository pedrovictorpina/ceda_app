<script setup lang="ts">
import { dailyMessage } from '~/data/contentCatalog'

definePageMeta({ middleware: 'auth' })
useSeoMeta({ title: 'Palavra do Dia' })

const saved = ref(false)
const publishedMessage = ref<Awaited<ReturnType<ReturnType<typeof usePublishedEditorial>['latest']>>>(null)
const currentMessage = computed(() => publishedMessage.value
  ? {
      slug: publishedMessage.value.slug,
      title: publishedMessage.value.title,
      excerpt: publishedMessage.value.content.split(/\n\s*\n/)[0] || publishedMessage.value.content,
      reference: 'Palavra do Dia',
      readTime: `${Math.max(1, Math.ceil(publishedMessage.value.content.trim().split(/\s+/).length / 180))} min de leitura`,
      author: 'Equipe pastoral CEDA'
    }
  : dailyMessage)

onMounted(async () => {
  publishedMessage.value = await usePublishedEditorial().latest('word_of_day')
})
</script>

<template>
  <div>
    <PageIntro
      title="Palavra do Dia"
      description="Uma pausa na rotina para ler, refletir e seguir o dia com propósito."
      icon="i-lucide-book-open-text"
    />

    <UCard class="relative max-w-4xl overflow-hidden border-primary/20">
      <div class="pointer-events-none absolute -right-20 -top-20 size-64 rounded-full bg-primary/10 blur-3xl" />
      <div class="relative p-1 sm:p-4">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <UBadge label="Hoje" />
          <span class="flex items-center gap-1.5 text-xs text-muted"><UIcon name="i-lucide-clock-3" />{{ currentMessage.readTime }}</span>
        </div>
        <p class="mt-8 text-sm font-semibold uppercase tracking-[0.18em] text-primary">
          {{ currentMessage.reference }}
        </p>
        <h2 class="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
          {{ currentMessage.title }}
        </h2>
        <p class="mt-5 max-w-3xl text-lg leading-8 text-muted">
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
            :variant="saved ? 'soft' : 'outline'"
            :icon="saved ? 'i-lucide-bookmark-check' : 'i-lucide-bookmark'"
            :label="saved ? 'Salva' : 'Salvar para depois'"
            @click="saved = !saved"
          />
        </div>
      </div>
      <template #footer>
        <div class="flex items-center gap-3">
          <UAvatar
            fallback="EP"
            size="sm"
          /><div>
            <p class="text-sm font-medium">
              {{ currentMessage.author }}
            </p><p class="text-xs text-muted">
              Conteúdo pastoral
            </p>
          </div>
        </div>
      </template>
    </UCard>

    <section class="mt-8 grid max-w-4xl gap-4 sm:grid-cols-2">
      <UCard>
        <UIcon
          name="i-lucide-notebook-pen"
          class="size-6 text-primary"
        />
        <h2 class="mt-3 font-semibold">
          Leve para a semana
        </h2>
        <p class="mt-2 text-sm leading-6 text-muted">
          Qual é o pequeno passo de amor, coragem ou reconciliação que está ao seu alcance hoje?
        </p>
      </UCard>
      <UCard>
        <UIcon
          name="i-lucide-newspaper"
          class="size-6 text-primary"
        />
        <h2 class="mt-3 font-semibold">
          Continue por dentro
        </h2>
        <p class="mt-2 text-sm leading-6 text-muted">
          Acompanhe comunicados, novidades e histórias da comunidade.
        </p>
        <UButton
          class="mt-4"
          to="/noticias"
          size="sm"
          color="neutral"
          variant="outline"
          label="Ver notícias"
        />
      </UCard>
    </section>
  </div>
</template>
