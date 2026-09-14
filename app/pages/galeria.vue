<script setup lang="ts">
import { getGallerySource } from '~/services/gallery'

definePageMeta({ middleware: 'auth' })
useSeoMeta({ title: 'Galeria' })
const config = useRuntimeConfig()
const source = computed(() => getGallerySource(config.public))
</script>

<template>
  <div>
    <PageIntro
      title="Galeria"
      description="Fotos publicadas por uma fonte externa configurável, sem duplicar arquivos no Supabase."
      icon="i-lucide-images"
    /><UAlert
      v-if="!source.configured"
      color="warning"
      variant="subtle"
      title="Galeria não configurada"
      description="Defina uma URL HTTPS embutível. Google Drive é uma opção, mas permissões e bloqueios de incorporação dependem do provedor."
    /><UCard v-else>
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
