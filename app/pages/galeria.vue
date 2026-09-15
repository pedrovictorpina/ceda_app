<script setup lang="ts">
import { getGallerySource } from '~/services/gallery'

definePageMeta({ middleware: 'auth' })
useSeoMeta({ title: 'Galeria' })
const config = useRuntimeConfig()
const source = computed(() => getGallerySource(config.public))
const { instagram, youtube } = useOfficialLinks()
</script>

<template>
  <div>
    <PageIntro
      title="Galeria"
      description="Reviva encontros, celebrações e momentos especiais da nossa comunidade."
      icon="i-lucide-images"
    /><UCard
      v-if="!source.configured"
      class="max-w-3xl"
    >
      <div class="py-5 text-center">
        <div class="mx-auto grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary">
          <UIcon
            name="i-lucide-images"
            class="size-8"
          />
        </div>
        <h2 class="mt-4 text-xl font-semibold">
          Nossos registros estão nos canais oficiais
        </h2>
        <p class="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted">
          Enquanto a galeria completa é organizada, você pode acompanhar fotos, vídeos e transmissões publicados pela CEDA.
        </p>
        <div class="mt-5 flex flex-wrap justify-center gap-3">
          <UButton
            :to="instagram"
            target="_blank"
            rel="noopener noreferrer"
            label="Ver Instagram"
            icon="i-lucide-instagram"
          />
          <UButton
            :to="youtube"
            target="_blank"
            rel="noopener noreferrer"
            color="neutral"
            variant="outline"
            label="Ver YouTube"
            icon="i-lucide-youtube"
          />
        </div>
      </div>
    </UCard><UCard v-else>
      <p class="font-semibold">
        Fonte externa configurada
      </p><p class="mt-1 text-sm text-muted">
        Provedor: {{ source.provider }}
      </p><UButton
        class="mt-4"
        :to="source.url"
        target="_blank"
        rel="noopener noreferrer"
        label="Abrir galeria"
        trailing-icon="i-lucide-external-link"
      />
    </UCard>
  </div>
</template>
