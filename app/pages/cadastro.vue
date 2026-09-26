<script setup lang="ts">
import { validateRegistration, type RegistrationErrors, type RegistrationInput } from '~/utils/registration'

definePageMeta({ layout: 'public' })
useSeoMeta({ title: 'Criar cadastro' })

const auth = useAuthStore()
const form = reactive<RegistrationInput>({
  fullName: '',
  email: '',
  phone: '',
  password: '',
  passwordConfirmation: '',
  acceptedPrivacy: false
})
const errors = ref<RegistrationErrors>({})
const pending = ref(false)
const feedback = ref<{ color: 'success' | 'error' | 'warning', title: string, description: string } | null>(null)
const passwordVisible = ref(false)
const confirmationVisible = ref(false)

onMounted(() => auth.hydrate())

async function submit() {
  errors.value = validateRegistration(form)
  feedback.value = null
  if (Object.keys(errors.value).length) return
  if (!auth.configured) {
    feedback.value = { color: 'warning', title: 'Supabase não configurado', description: 'O cadastro não foi enviado. Configure as chaves públicas locais conforme o README.' }
    return
  }

  pending.value = true
  try {
    const result = await auth.signUp(form)
    feedback.value = result.requiresEmailConfirmation
      ? { color: 'success', title: 'Confira seu e-mail', description: 'Enviamos uma confirmação. Depois de confirmar, volte para entrar.' }
      : { color: 'success', title: 'Cadastro criado', description: 'Sua conta está pronta. Você já pode acessar a área de membros.' }
    if (!result.requiresEmailConfirmation) await navigateTo('/inicio')
  } catch (error) {
    feedback.value = { color: 'error', title: 'Não foi possível criar o cadastro', description: error instanceof Error ? error.message : 'Tente novamente.' }
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <section class="mx-auto flex min-h-[calc(100vh-4rem)] max-w-xl items-center px-4 py-12">
    <BrandLoadingScreen
      v-if="pending"
      label="Criando cadastro…"
    />
    <UCard class="w-full">
      <template #header>
        <BrandLogo
          variant="auth"
          class="mb-4 flex"
        />
        <h1 class="text-2xl font-bold">
          Criar cadastro
        </h1>
        <p class="mt-1 text-sm text-muted">
          Preencha seus dados para solicitar acesso à comunidade.
        </p>
      </template>

      <form
        class="space-y-4"
        novalidate
        @submit.prevent="submit"
      >
        <UAlert
          v-if="!auth.loading && !auth.configured"
          color="warning"
          variant="subtle"
          title="Ambiente sem Supabase"
          description="O formulário pode ser revisado, mas não envia dados enquanto as chaves públicas não estiverem configuradas."
        />
        <UAlert
          v-if="feedback"
          :color="feedback.color"
          variant="subtle"
          :title="feedback.title"
          :description="feedback.description"
        />

        <UFormField
          label="Nome completo"
          required
          :error="errors.fullName"
        >
          <UInput
            v-model="form.fullName"
            autocomplete="name"
            class="w-full"
          />
        </UFormField>
        <div class="grid gap-4 sm:grid-cols-2">
          <UFormField
            label="E-mail"
            required
            :error="errors.email"
          >
            <UInput
              v-model="form.email"
              type="email"
              autocomplete="email"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="Telefone (opcional)"
            :error="errors.phone"
          >
            <UInput
              v-model="form.phone"
              type="tel"
              autocomplete="tel"
              class="w-full"
            />
          </UFormField>
        </div>
        <UFormField
          label="Senha"
          required
          hint="8+ caracteres, com maiúscula, minúscula e número"
          :error="errors.password"
        >
          <UInput
            v-model="form.password"
            :type="passwordVisible ? 'text' : 'password'"
            autocomplete="new-password"
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
                @click="passwordVisible = !passwordVisible"
              />
            </template>
          </UInput>
        </UFormField>
        <UFormField
          label="Confirmar senha"
          required
          :error="errors.passwordConfirmation"
        >
          <UInput
            v-model="form.passwordConfirmation"
            :type="confirmationVisible ? 'text' : 'password'"
            autocomplete="new-password"
            class="w-full"
          >
            <template #trailing>
              <UButton
                type="button"
                color="neutral"
                variant="ghost"
                size="xs"
                :icon="confirmationVisible ? 'i-lucide-eye-off' : 'i-lucide-eye'"
                :aria-label="confirmationVisible ? 'Ocultar confirmação de senha' : 'Mostrar confirmação de senha'"
                @click="confirmationVisible = !confirmationVisible"
              />
            </template>
          </UInput>
        </UFormField>
        <UFormField :error="errors.acceptedPrivacy">
          <UCheckbox v-model="form.acceptedPrivacy">
            <template #label>
              Li e aceito a
              <NuxtLink
                to="/privacidade"
                target="_blank"
                class="font-medium text-primary hover:underline"
              >Política de Privacidade</NuxtLink>
            </template>
          </UCheckbox>
        </UFormField>
        <UButton
          type="submit"
          block
          :loading="pending"
          label="Criar cadastro"
        />
        <p class="text-center text-sm text-muted">
          Já possui cadastro?
          <NuxtLink
            to="/entrar"
            class="focus-ring rounded-sm font-medium text-primary hover:underline"
          >Voltar para entrar</NuxtLink>
        </p>
      </form>
    </UCard>
  </section>
</template>
