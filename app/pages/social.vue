<script setup lang="ts">
definePageMeta({ middleware: 'auth' })
useSeoMeta({ title: 'Social e transmissões' })
const { website, instagram, youtube } = useOfficialLinks()
</script>

<template>
  <div>
    <PageIntro
      title="Social e transmissões"
      description="Links oficiais e integrações futuras permanecem desacoplados."
      icon="i-lucide-play-square"
    /><div class="grid gap-4 sm:grid-cols-3">
      <UCard>
        <UIcon
          name="i-lucide-globe"
          class="size-7 text-primary"
        /><h2 class="mt-3 font-semibold">
          Site
        </h2><p class="mt-1 text-sm text-muted">
          Site público oficial.
        </p><template #footer>
          <UButton
            v-if="website"
            :to="website"
            target="_blank"
            rel="noopener noreferrer"
            label="Abrir site"
          /><UBadge
            v-else
            color="neutral"
            label="Não configurado"
          />
        </template>
      </UCard><UCard>
        <UIcon
          name="i-lucide-instagram"
          class="size-7 text-primary"
        /><h2 class="mt-3 font-semibold">
          Instagram
        </h2><p class="mt-1 text-sm text-muted">
          Link do perfil oficial; a integração de feed será um serviço separado.
        </p><template #footer>
          <UButton
            v-if="instagram"
            :to="instagram"
            target="_blank"
            rel="noopener noreferrer"
            label="Abrir Instagram"
          /><UBadge
            v-else
            color="neutral"
            label="Não configurado"
          />
        </template>
      </UCard><UCard>
        <UIcon
          name="i-lucide-youtube"
          class="size-7 text-primary"
        /><h2 class="mt-3 font-semibold">
          YouTube
        </h2><p class="mt-1 text-sm text-muted">
          Canal oficial da CEDA para transmissões e vídeos publicados.
        </p><template #footer>
          <UButton
            :to="youtube"
            target="_blank"
            rel="noopener noreferrer"
            label="Abrir YouTube"
          />
        </template>
      </UCard>
    </div>
  </div>
</template>
