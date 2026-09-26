<script setup lang="ts">
definePageMeta({ layout: 'public' })
useSeoMeta({ title: 'Entrar' })
const auth = useAuthStore()
const form = reactive({ email: '', password: '', rememberAccess: true })
const pending = ref(false)
const errorMessage = ref('')
const passwordVisible = ref(false)

onMounted(async () => {
  await auth.hydrate()
  form.rememberAccess = auth.rememberAccess
})

async function submit() {
  pending.value = true
  errorMessage.value = ''
  try {
    await auth.signIn(form.email, form.password, form.rememberAccess)
    await navigateTo('/inicio')
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Não foi possível entrar.'
  } finally { pending.value = false }
}
</script>

<template>
  <section class="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md items-center px-4 py-12">
    <BrandLoadingScreen
      v-if="pending"
      label="Entrando…"
    />
    <UCard class="w-full">
      <template #header>
        <BrandLogo
          variant="auth"
          class="mb-4 flex"
        />
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
          v-if="!auth.loading && !auth.configured"
          color="warning"
          variant="subtle"
          title="Ambiente local sem Supabase"
          description="O cadastro e o login estão desativados até configurar as chaves públicas descritas no README."
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
            :type="passwordVisible ? 'text' : 'password'"
            autocomplete="current-password"
            class="w-full"
          >
            <template #trailing>
              <UButton
                type="button"
                color="neutral"
                variant="ghost"
                size="xs"
                :icon="passwordVisible ? 'i-lucide-eye-off' : 'i-lucide-eye'"
                :aria-label="passwordVisible ? 'Ocultar senha' : 'Mostrar senha'"
                :title="passwordVisible ? 'Ocultar senha' : 'Mostrar senha'"
                @click="passwordVisible = !passwordVisible"
              />
            </template>
          </UInput>
        </UFormField>
        <UCheckbox
          v-model="form.rememberAccess"
          label="Lembrar meu acesso"
          description="Mantém a sessão neste dispositivo, inclusive após atualizações. A senha nunca é armazenada."
        />
        <UButton
          type="submit"
          block
          :loading="pending"
          label="Entrar"
        />
        <p class="text-center text-sm text-muted">
          Ainda não tem uma conta?
          <NuxtLink
            to="/cadastro"
            class="focus-ring rounded-sm font-medium text-primary hover:underline"
          >Criar cadastro</NuxtLink>
        </p>
      </form>
    </UCard>
  </section>
</template>
