<script setup lang="ts">
definePageMeta({ layout: 'public' })
useSeoMeta({ title: 'Bem-vindo', description: 'Uma base digital para viver comunidade, agenda e cuidado.' })
</script>

<template>
  <section class="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl items-center gap-10 px-4 py-16 lg:grid-cols-2">
    <div>
      <UBadge
        color="primary"
        variant="subtle"
        label="Site e aplicativo"
      />
      <h1 class="mt-5 text-4xl font-black tracking-tight sm:text-6xl">
        Comunidade que caminha junta.
      </h1>
      <p class="mt-5 max-w-xl text-lg text-muted">
        Mensagens, grupos, eventos e cuidado em um ambiente simples para membros e equipes.
      </p>
      <div class="mt-8 flex flex-wrap gap-3">
        <UButton
          to="/entrar"
          size="xl"
          label="Acessar área de membros"
          trailing-icon="i-lucide-arrow-right"
        /><UButton
          to="/eventos"
          size="xl"
          color="neutral"
          variant="outline"
          label="Conhecer a agenda"
        />
      </div>
    </div>
    <UCard class="border-primary/20 bg-gradient-to-br from-primary/10 to-default">
      <div class="space-y-5 p-3">
        <UIcon
          name="i-lucide-sparkles"
          class="size-10 text-primary"
        /><h2 class="text-2xl font-bold">
          Uma fundação pronta para crescer
        </h2><p class="text-muted">
          Esta primeira versão apresenta a estrutura do produto. Conteúdo editorial, identidade final e integrações serão configurados nas próximas etapas.
        </p>
      </div>
    </UCard>
  </section>
</template>
