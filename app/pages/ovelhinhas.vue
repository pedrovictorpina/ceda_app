<script setup lang="ts">
definePageMeta({ middleware: ['auth', 'guardian'] })
useSeoMeta({ title: 'Ovelhinhas' })
</script>

<template>
  <div>
    <PageIntro
      title="Ovelhinhas"
      description="Área privada para responsáveis aprovados e equipe infantil autorizada."
      icon="i-lucide-heart-handshake"
    /><UAlert
      class="mb-5"
      color="warning"
      variant="subtle"
      title="Dados protegidos"
      description="Perfis infantis não são públicos. A interface e as políticas do banco limitam a consulta às crianças vinculadas ou à equipe infantil."
    /><UCard>
      <div class="py-10 text-center">
        <UIcon
          name="i-lucide-shield-check"
          class="mx-auto size-10 text-primary"
        /><h2 class="mt-3 font-semibold">
          Nenhuma criança vinculada
        </h2><p class="mt-1 text-sm text-muted">
          Um administrador pode aprovar o acesso e gerenciar vínculos de responsáveis.
        </p>
      </div>
    </UCard>
  </div>
</template>
