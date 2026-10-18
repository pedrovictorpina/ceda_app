<script setup lang="ts">
import { authErrorMessage, authFlowLink, safeAuthReturnTo, validatePasswordChange } from '~/utils/authFlow'

definePageMeta({ layout: 'public' })
useSeoMeta({ title: 'Escolher nova senha' })
const auth = useAuthStore()
const route = useRoute()
const form = reactive({ password: '', confirmation: '' })
const errors = ref<{ password?: string, confirmation?: string }>({})
const checking = ref(true)
const ready = ref(false)
const pending = ref(false)
const saved = ref(false)
const errorMessage = ref('')
const passwordVisible = ref(false)
const confirmationVisible = ref(false)
const destination = computed(() => safeAuthReturnTo(route.query.next))

onMounted(async () => {
  try {
    const callbackHash = new URLSearchParams(window.location.hash.slice(1))
    if (route.query.error || route.query.error_code || callbackHash.has('error') || callbackHash.has('error_code')) {
      errorMessage.value = 'Este link expirou ou já foi usado. Peça outro link de recuperação para continuar.'
      return
    }
    ready.value = await auth.preparePasswordReset(route.query.code, route.query.recuperacao)
    if (!ready.value) {
      errorMessage.value = typeof route.query.code === 'string'
        ? 'Abra o link no mesmo navegador em que pediu a recuperação. Se não conseguir, peça um novo link abaixo neste navegador.'
        : 'Abra o link recebido por e-mail para escolher sua nova senha. Se ele expirou, peça outro abaixo.'
    }
  } catch (error) {
    errorMessage.value = authErrorMessage(error, 'password')
  } finally { checking.value = false }
})

async function submit() {
  errors.value = validatePasswordChange(form.password, form.confirmation)
  if (Object.keys(errors.value).length || !ready.value || pending.value) return
  pending.value = true
  errorMessage.value = ''
  try {
    await auth.updatePassword(form.password)
    saved.value = true
    form.password = ''
    form.confirmation = ''
  } catch (error) {
    errorMessage.value = authErrorMessage(error, 'password')
  } finally { pending.value = false }
}

async function continueToDestination() {
  pending.value = true
  errorMessage.value = ''
  try {
    await auth.hydrate()
    await navigateTo(auth.profile ? destination.value : authFlowLink('/entrar', destination.value))
  } catch (error) {
    errorMessage.value = authErrorMessage(error, 'session')
  } finally { pending.value = false }
}
</script>

<template>
  <section class="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md items-center px-4 py-10">
    <UCard class="w-full">
      <template #header>
        <BrandLogo
          variant="auth"
          class="mb-4 flex"
        />
        <h1 class="text-2xl font-bold">
          Escolher nova senha
        </h1>
        <p class="mt-2 text-sm leading-6 text-muted">
          Crie uma senha que você ainda não usou nesta conta.
        </p>
      </template>
      <div
        v-if="checking"
        role="status"
        class="flex items-center gap-3 py-5 text-muted"
      >
        <UIcon
          name="i-lucide-loader-circle"
          class="size-5 animate-spin"
        />
        Verificando seu link…
      </div>
      <div
        v-else
        class="space-y-4"
      >
        <UAlert
          v-if="errorMessage"
          color="error"
          variant="subtle"
          title="Precisamos da sua atenção"
          :description="errorMessage"
        />
        <template v-if="saved">
          <UAlert
            color="success"
            variant="subtle"
            icon="i-lucide-check-circle-2"
            title="Senha atualizada"
            description="Sua nova senha já está valendo. Você pode continuar para a página que escolheu."
          />
          <UButton
            block
            :loading="pending"
            label="Continuar"
            @click="continueToDestination"
          />
        </template>
        <UForm
          v-else-if="ready"
          :state="form"
          class="space-y-4"
          novalidate
          @submit="submit"
        >
          <UFormField
            label="Nova senha"
            name="password"
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
                  :aria-label="passwordVisible ? 'Ocultar nova senha' : 'Mostrar nova senha'"
                  @click="passwordVisible = !passwordVisible"
                />
              </template>
            </UInput>
          </UFormField>
          <UFormField
            label="Confirmar nova senha"
            name="confirmation"
            required
            :error="errors.confirmation"
          >
            <UInput
              v-model="form.confirmation"
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
          <UButton
            type="submit"
            block
            :loading="pending"
            label="Salvar nova senha"
          />
        </UForm>
        <UButton
          v-if="!saved"
          :to="authFlowLink('/recuperar-senha', destination)"
          block
          color="neutral"
          variant="outline"
          label="Pedir novo link de recuperação"
        />
        <UButton
          v-if="!saved"
          :to="authFlowLink('/entrar', destination)"
          block
          variant="link"
          label="Voltar para entrar"
        />
      </div>
    </UCard>
  </section>
</template>
