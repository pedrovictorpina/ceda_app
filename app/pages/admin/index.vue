<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: ['auth', 'admin'] })
useSeoMeta({ title: 'Administração' })
const cards = [{ title: 'Pessoas e permissões', icon: 'i-lucide-users-round' }, { title: 'Mensagens', icon: 'i-lucide-notebook-pen' }, { title: 'Comunidades', icon: 'i-lucide-house-heart' }, { title: 'Ministérios', icon: 'i-lucide-music' }, { title: 'Agenda', icon: 'i-lucide-calendar-cog' }, { title: 'Ovelhinhas', icon: 'i-lucide-baby' }]
</script>

<template>
  <div>
    <PageIntro
      title="Painel administrativo"
      description="As mesmas funções administrativas no web e no app, adaptadas ao espaço disponível."
      icon="i-lucide-shield-check"
    /><div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <UCard
        v-for="card in cards"
        :key="card.title"
      >
        <UIcon
          :name="card.icon"
          class="size-7 text-primary"
        /><h2 class="mt-3 font-semibold">
          {{ card.title }}
        </h2><p class="mt-1 text-sm text-muted">
          Tela-base pronta para conectar aos fluxos do domínio.
        </p><template #footer>
          <UButton
            size="sm"
            color="neutral"
            variant="outline"
            label="Gerenciar"
          />
        </template>
      </UCard>
    </div>
  </div>
</template>
