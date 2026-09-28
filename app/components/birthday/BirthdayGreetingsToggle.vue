<script setup lang="ts">
defineProps<{ hasBirthDate: boolean, available: boolean }>()
const optIn = defineModel<boolean>({ required: true })
</script>

<template>
  <div class="mt-4 rounded-xl border border-default bg-elevated/40 p-4">
    <USwitch
      v-model="optIn"
      :disabled="!available"
      label="Quero receber felicitações"
      description="Seu nome, sua foto e o dia do aniversário aparecem para os membros em Aniversariantes. O ano e a idade nunca são exibidos."
      checked-icon="i-lucide-cake"
      unchecked-icon="i-lucide-eye-off"
    />
    <p
      v-if="!available"
      class="mt-3 text-xs leading-5 text-muted"
    >
      Esta opção estará disponível em breve.
    </p>
    <p
      v-else-if="optIn && !hasBirthDate"
      class="mt-3 text-xs leading-5 text-warning"
    >
      Informe sua data de nascimento acima para aparecer entre os aniversariantes.
    </p>
    <NuxtLink
      v-else
      to="/aniversariantes"
      class="focus-ring mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-md text-sm font-medium text-primary hover:underline"
    >
      <UIcon
        name="i-lucide-cake"
        class="size-4"
      />
      Ver aniversariantes
    </NuxtLink>
  </div>
</template>
