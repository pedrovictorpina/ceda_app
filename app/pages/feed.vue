<script setup lang="ts">
definePageMeta({ middleware: 'auth' })
useSeoMeta({ title: 'Feed' })
</script>

<template>
  <div>
    <PageIntro
      title="Feed"
      description="Publicações da comunidade com imagens, comentários, curtidas e links compartilháveis."
      icon="i-lucide-messages-square"
    /><UCard class="max-w-2xl">
      <template #header>
        <div class="flex items-center gap-3">
          <UAvatar fallback="CM" /><div>
            <p class="font-semibold">
              Comunicação CEDA
            </p><p class="text-xs text-muted">
              Hoje
            </p>
          </div>
        </div>
      </template><h2 class="text-xl font-bold">
        Bem-vindos à nossa comunidade digital
      </h2><p class="mt-2 text-muted">
        Tela-base do feed. As interações serão conectadas ao Supabase nas próximas etapas.
      </p><template #footer>
        <div class="flex gap-2">
          <UButton
            color="neutral"
            variant="ghost"
            icon="i-lucide-heart"
            label="Curtir"
          /><UButton
            color="neutral"
            variant="ghost"
            icon="i-lucide-message-circle"
            label="Comentar"
          /><UButton
            color="neutral"
            variant="ghost"
            icon="i-lucide-share-2"
            label="Compartilhar"
          />
        </div>
      </template>
    </UCard>
  </div>
</template>
