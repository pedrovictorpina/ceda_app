<script setup lang="ts">
import { validateRegistration, type RegistrationErrors, type RegistrationInput } from '~/utils/registration'
import { MIN_BIRTH_DATE, todayInTimeZone } from '~/utils/birthdays'
import { invitationDescription, isRegistrationInvitation } from '~/utils/invitations'
import { authErrorMessage, authFlowLink, safeAuthReturnTo } from '~/utils/authFlow'

definePageMeta({ layout: 'public' })
useSeoMeta({ title: 'Criar cadastro' })

const auth = useAuthStore()
const route = useRoute()
const form = reactive<RegistrationInput>({
  fullName: '',
  email: '',
  phone: '',
  password: '',
  passwordConfirmation: '',
  acceptedPrivacy: false,
  birthDate: '',
  birthdayGreetingsOptIn: false
})
const today = todayInTimeZone()
const errors = ref<RegistrationErrors>({})
const pending = ref(false)
const feedback = ref<{ color: 'success' | 'error' | 'warning', title: string, description: string } | null>(null)
const passwordVisible = ref(false)
const confirmationVisible = ref(false)
const emailConfirmationRequired = ref(false)
const invitationSource = computed(() => route.query.origem === 'familia' ? 'family' : 'general')
const hasInvitation = computed(() => isRegistrationInvitation(route.query))
const destination = computed(() => safeAuthReturnTo(route.query.next))

onMounted(async () => {
  try {
    await auth.hydrate()
  } catch (error) {
    feedback.value = { color: 'warning', title: 'Não foi possível verificar seu acesso', description: authErrorMessage(error, 'session') }
  }
})

async function submit() {
  if (pending.value) return
  errors.value = validateRegistration(form)
  feedback.value = null
  if (Object.keys(errors.value).length) return
  if (!auth.configured) {
    feedback.value = { color: 'warning', title: 'Cadastro temporariamente indisponível', description: 'Seus dados não foram enviados. Tente novamente mais tarde ou fale com a recepção.' }
    return
  }

  pending.value = true
  try {
    const result = await auth.signUp(form, destination.value)
    emailConfirmationRequired.value = result.requiresEmailConfirmation
    feedback.value = result.requiresEmailConfirmation
      ? { color: 'success', title: 'Confira seu e-mail para continuar', description: 'Se o cadastro precisar de confirmação, você receberá um link. Confira a caixa de entrada e o spam; abra o link neste navegador. Se já possui conta, volte para entrar ou recupere sua senha.' }
      : { color: 'success', title: 'Cadastro criado', description: 'Sua conta está pronta. Você já pode acessar a área de membros.' }
    form.password = ''
    form.passwordConfirmation = ''
    if (!result.requiresEmailConfirmation) await navigateTo(destination.value)
  } catch (error) {
    feedback.value = { color: 'error', title: 'Não foi possível criar o cadastro', description: authErrorMessage(error, 'signUp') }
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
          Crie sua conta para participar da comunidade. Se for necessário confirmar o e-mail, explicamos o próximo passo após o envio.
        </p>
      </template>

      <UAlert
        v-if="feedback"
        :color="feedback.color"
        variant="subtle"
        :title="feedback.title"
        :description="feedback.description"
        class="mb-4"
      />
      <div
        v-if="emailConfirmationRequired"
        class="space-y-4"
      >
        <p class="text-sm leading-6 text-muted">
          O endereço informado foi <strong class="break-all">{{ form.email }}</strong>.
        </p>
        <UButton
          :to="authFlowLink('/entrar', destination)"
          block
          label="Já confirmei meu e-mail — entrar"
        />
        <UButton
          :to="authFlowLink('/recuperar-senha', destination)"
          block
          color="neutral"
          variant="outline"
          label="Já tenho conta e esqueci a senha"
        />
        <UButton
          block
          variant="link"
          label="Corrigir o e-mail informado"
          @click="emailConfirmationRequired = false; feedback = null"
        />
      </div>
      <UForm
        v-else
        :state="form"
        class="space-y-4"
        novalidate
        @submit="submit"
      >
        <UAlert
          v-if="!auth.loading && !auth.configured"
          color="warning"
          variant="subtle"
          title="Cadastro temporariamente indisponível"
          description="Você pode conhecer a igreja e consultar os contatos sem criar uma conta. Tente novamente mais tarde."
        />
        <UAlert
          v-if="hasInvitation"
          color="primary"
          variant="subtle"
          icon="i-lucide-heart-handshake"
          title="Você recebeu um convite"
          :description="invitationDescription(invitationSource)"
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
        <div class="space-y-3 rounded-2xl border border-default bg-elevated/40 p-4">
          <UFormField
            label="Data de nascimento (opcional)"
            hint="Mostramos só o dia e o mês"
            :error="errors.birthDate"
          >
            <AppDatePicker
              v-model="form.birthDate"
              placeholder="Selecionar data de nascimento"
              :min="MIN_BIRTH_DATE"
              :max="today"
            />
          </UFormField>
          <UCheckbox
            v-model="form.birthdayGreetingsOptIn"
            label="Quero receber felicitações"
            description="Seu nome, sua foto e o dia do aniversário (sem o ano) aparecem para os membros em Aniversariantes. Você pode mudar isso no perfil."
          />
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
              <ULink
                to="/privacidade"
                target="_blank"
                class="font-medium text-primary hover:underline"
              >Política de Privacidade</ULink>
            </template>
          </UCheckbox>
        </UFormField>
        <UButton
          type="submit"
          block
          :loading="pending"
          :disabled="!auth.configured"
          label="Criar cadastro"
        />
        <p class="text-center text-sm text-muted">
          Já possui cadastro?
          <ULink
            :to="authFlowLink('/entrar', destination)"
            class="focus-ring rounded-sm font-medium text-primary hover:underline"
          >Voltar para entrar</ULink>
        </p>
      </UForm>
    </UCard>
  </section>
</template>
