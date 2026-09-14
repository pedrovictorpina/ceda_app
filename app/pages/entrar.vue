<script setup lang="ts">
definePageMeta({ layout: 'public' })
useSeoMeta({ title: 'Entrar' })
const auth = useAuthStore()
const form = reactive({ email: '', password: '' })
const pending = ref(false)
const errorMessage = ref('')

async function submit() {
  pending.value = true
  errorMessage.value = ''
  try {
    await auth.signIn(form.email, form.password)
    await navigateTo('/inicio')
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Não foi possível entrar.'
  } finally { pending.value = false }
}
</script>

<template>
  <section class="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md items-center px-4 py-12">
    <UCard class="w-full">
      <template #header>
        <h1 class="text-2xl font-bold">
          Área de membros
        </h1><p class="mt-1 text-sm text-muted">
          Entre com o e-mail cadastrado.
        </p>
      </template>
      <form
        class="space-y-4"
        @submit.prevent="submit"
      >
        <UAlert
          v-if="!auth.configured"
          color="warning"
          variant="subtle"
          title="Ambiente local sem Supabase"
          description="Copie .env.example para .env e configure as chaves públicas."
        />
        <UAlert
          v-if="errorMessage"
          color="error"
          variant="subtle"
          :description="errorMessage"
        />
        <UFormField
          label="E-mail"
          required
        >
          <UInput
            v-model="form.email"
            type="email"
            autocomplete="email"
            class="w-full"
          />
        </UFormField>
        <UFormField
          label="Senha"
          required
        >
          <UInput
            v-model="form.password"
            type="password"
            autocomplete="current-password"
            class="w-full"
          />
        </UFormField>
        <UButton
          type="submit"
          block
          :loading="pending"
          label="Entrar"
        />
      </form>
    </UCard>
  </section>
</template>
