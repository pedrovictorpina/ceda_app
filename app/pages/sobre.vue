<script setup lang="ts">
definePageMeta({ layout: 'public' })
useSeoMeta({ title: 'Sobre Nós' })
const { address } = useOfficialLinks()
</script>

<template>
  <div>
    <PageIntro
      title="Sobre Nós"
      description="Nossa história, liderança e áreas de cuidado, a partir dos mesmos perfis e cargos do sistema."
      icon="i-lucide-landmark"
    /><UCard>
      <h2 class="text-xl font-bold">
        Uma igreja, muitas pessoas servindo
      </h2><p class="mt-2 text-muted">
        A apresentação institucional e a hierarquia pública serão preenchidas pela administração. Perfis não são duplicados e só aparecem mediante publicação consentida.
      </p><p class="mt-4 flex items-center gap-2 text-sm">
        <UIcon name="i-lucide-map-pin" />{{ address || 'Endereço oficial ainda não configurado' }}
      </p><div class="mt-6 grid gap-3 sm:grid-cols-3">
        <div
          v-for="role in ['Pastor presidente', 'Pastores por área', 'Líderes de grupos e ministérios']"
          :key="role"
          class="rounded-lg bg-elevated p-4"
        >
          <p class="font-medium">
            {{ role }}
          </p><p class="mt-1 text-sm text-muted">
            Aguardando cadastro
          </p>
        </div>
      </div>
    </UCard>
  </div>
</template>
