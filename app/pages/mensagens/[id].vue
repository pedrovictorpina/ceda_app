<script setup lang="ts">
import { dailyMessage } from '~/data/contentCatalog'

definePageMeta({ middleware: 'auth' })
const route = useRoute()
useSeoMeta({ title: dailyMessage.title, description: dailyMessage.excerpt })

const copied = ref(false)
const isKnownMessage = computed(() => route.params.id === dailyMessage.slug || route.params.id === 'exemplo')

async function shareMessage() {
  const payload = { title: dailyMessage.title, text: dailyMessage.excerpt, url: window.location.href }
  if (navigator.share) await navigator.share(payload)
  else {
    await navigator.clipboard.writeText(window.location.href)
    copied.value = true
  }
}
</script>

<template>
  <article
    v-if="isKnownMessage"
    class="mx-auto max-w-3xl pb-10"
  >
    <NuxtLink
      to="/palavra-do-dia"
      class="focus-ring mb-6 inline-flex items-center gap-2 rounded text-sm font-medium text-primary"
    ><UIcon name="i-lucide-arrow-left" />Voltar para Palavra do Dia</NuxtLink>
    <div class="rounded-2xl border border-default bg-gradient-to-br from-primary/10 via-default to-default p-6 sm:p-10">
      <div class="flex flex-wrap items-center gap-3">
        <UBadge :label="dailyMessage.eyebrow" /><span class="text-sm text-muted">{{ dailyMessage.readTime }}</span>
      </div>
      <p class="mt-8 text-sm font-semibold uppercase tracking-[0.18em] text-primary">
        {{ dailyMessage.reference }}
      </p>
      <h1 class="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
        {{ dailyMessage.title }}
      </h1>
      <p class="mt-5 text-xl leading-8 text-muted">
        {{ dailyMessage.excerpt }}
      </p>
    </div>

    <div class="mt-10 space-y-6 text-lg leading-8">
      <p
        v-for="paragraph in dailyMessage.body"
        :key="paragraph"
      >
        {{ paragraph }}
      </p>
    </div>

    <blockquote class="my-10 border-l-4 border-primary bg-primary/5 p-5 text-lg italic leading-8">
      “Lâmpada para os meus pés é tua palavra e luz para o meu caminho.”
      <footer class="mt-2 text-sm not-italic text-muted">
        {{ dailyMessage.reference }}
      </footer>
    </blockquote>

    <div class="flex flex-col justify-between gap-4 border-t border-default pt-6 sm:flex-row sm:items-center">
      <div class="flex items-center gap-3">
        <UAvatar fallback="EP" /><div>
          <p class="font-medium">
            {{ dailyMessage.author }}
          </p><p class="text-sm text-muted">
            Publicado hoje
          </p>
        </div>
      </div>
      <UButton
        color="neutral"
        variant="outline"
        :icon="copied ? 'i-lucide-check' : 'i-lucide-share-2'"
        :label="copied ? 'Link copiado' : 'Compartilhar mensagem'"
        @click="shareMessage"
      />
    </div>
  </article>

  <div
    v-else
    class="mx-auto max-w-xl py-16 text-center"
  >
    <UIcon
      name="i-lucide-file-question-mark"
      class="mx-auto size-12 text-muted"
    />
    <h1 class="mt-4 text-2xl font-bold">
      Mensagem não encontrada
    </h1>
    <p class="mt-2 text-muted">
      Este link pode ter expirado ou o conteúdo ainda não foi publicado.
    </p>
    <UButton
      class="mt-6"
      to="/palavra-do-dia"
      label="Ir para a mensagem de hoje"
    />
  </div>
</template>
