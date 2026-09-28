<script setup lang="ts">
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'
import type { ChildFormValue } from '~/types/children'
import type { ActionResult, FamilyChild } from '~/composables/useFamilyChildren'
import { canTeachChildren } from '~/utils/authorization'

definePageMeta({ middleware: 'auth' })
useSeoMeta({ title: 'Sementinhas' })

const REFRESH_MS = 8000

const auth = useAuthStore()
const toast = useToast()
const family = useFamilyChildren()
const { children, openAlerts, loading, loadError } = family
const busyChildId = ref('')
const acknowledgingId = ref('')
const formOpen = ref(false)
const editingChild = ref<FamilyChild | undefined>()
const saving = ref(false)
const removing = ref(false)
const pickerOpen = ref(false)
const pickerChild = ref<FamilyChild | undefined>()
const isTeacher = computed(() => canTeachChildren(auth.profile))
let refreshTimer: ReturnType<typeof setInterval> | undefined
let knownAlertIds = new Set<string>()

function childName(childId: string) {
  return children.value.find(child => child.id === childId)?.full_name.split(' ')[0] ?? 'Sua criança'
}

function className(classId: string | null) {
  if (!classId) return ''
  return children.value.flatMap(child => child.classes).find(item => item.id === classId)?.name ?? ''
}

function report(result: ActionResult, success: string) {
  if (!result.ok) {
    toast.add({ title: 'Não deu certo', description: result.message, color: 'error', icon: 'i-lucide-circle-alert' })
    return false
  }
  toast.add({
    title: success,
    description: result.warning,
    color: result.warning ? 'warning' : 'success',
    icon: result.warning ? 'i-lucide-info' : 'i-lucide-circle-check'
  })
  return true
}

function openForm(child?: FamilyChild) {
  editingChild.value = child
  formOpen.value = true
}

async function saveChild(payload: { form: ChildFormValue, photo: File | null, removePhoto: boolean }) {
  saving.value = true
  const child = editingChild.value
  const result = child
    ? await family.updateChild({ ...payload, child })
    : await family.registerChild(payload)
  saving.value = false
  if (report(result, child ? 'Dados atualizados' : 'Criança cadastrada')) formOpen.value = false
}

async function removeChild() {
  if (!editingChild.value) return
  removing.value = true
  const result = await family.removeChild(editingChild.value)
  removing.value = false
  if (report(result, 'Criança removida')) formOpen.value = false
}

async function checkIn(child: FamilyChild, classId?: string) {
  const targetClass = classId ?? (child.classes.length === 1 ? child.classes[0]?.id : undefined)
  if (!targetClass) {
    pickerChild.value = child
    pickerOpen.value = true
    return
  }
  busyChildId.value = child.id
  const result = await family.checkIn(child.id, targetClass)
  busyChildId.value = ''
  pickerOpen.value = false
  if (report(result, `${child.full_name.split(' ')[0]} está na salinha`)) {
    Haptics.impact({ style: ImpactStyle.Medium }).catch(() => undefined)
  }
}

async function checkOut(child: FamilyChild) {
  const checkin = family.activeCheckin(child.id)
  if (!checkin) return
  busyChildId.value = child.id
  const result = await family.checkOut(checkin.id)
  busyChildId.value = ''
  report(result, `Saída de ${child.full_name.split(' ')[0]} registrada`)
}

async function acknowledge(alertId: string) {
  acknowledgingId.value = alertId
  const result = await family.acknowledge(alertId)
  acknowledgingId.value = ''
  report(result, 'A equipe sabe que você está a caminho')
}

async function refresh(silent = false) {
  await family.load(silent)
  const fresh = openAlerts.value.filter(alert => !knownAlertIds.has(alert.id))
  if (silent && fresh.length) Haptics.notification({ type: NotificationType.Warning }).catch(() => undefined)
  knownAlertIds = new Set(openAlerts.value.map(alert => alert.id))
}

onMounted(() => {
  void refresh()
  refreshTimer = setInterval(() => {
    const idle = !loading.value && !busyChildId.value && !saving.value && !removing.value
    if (document.visibilityState === 'visible' && idle) void refresh(true)
  }, REFRESH_MS)
})
onUnmounted(() => {
  if (refreshTimer) clearInterval(refreshTimer)
})
</script>

<template>
  <div>
    <SementinhasAlertBanner
      :alerts="openAlerts"
      :child-name="childName"
      :class-name="className"
      :acknowledging-id="acknowledgingId"
      @acknowledge="acknowledge"
    />

    <PageIntro
      title="Sementinhas"
      description="Cadastre seus filhos, faça o check-in na salinha e receba os chamados da equipe infantil."
      icon="i-lucide-sprout"
    />

    <UAlert
      v-if="loadError"
      class="mb-5"
      color="warning"
      variant="subtle"
      icon="i-lucide-wifi-off"
      :description="loadError"
    />

    <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h2 class="text-xl font-bold tracking-tight">
        Meus filhos
      </h2>
      <div class="flex flex-wrap gap-2">
        <UButton
          v-if="isTeacher"
          color="neutral"
          variant="outline"
          icon="i-lucide-school"
          label="Área dos professores"
          to="/sementinhas/turmas"
          class="min-h-11 rounded-full"
        />
        <UButton
          color="neutral"
          variant="ghost"
          icon="i-lucide-refresh-cw"
          label="Atualizar"
          class="min-h-11 rounded-full"
          :loading="loading"
          @click="refresh()"
        />
      </div>
    </div>

    <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <template v-if="loading && !children.length">
        <USkeleton
          v-for="index in 2"
          :key="index"
          class="h-64 rounded-2xl"
        />
      </template>
      <SementinhasChildCard
        v-for="child in children"
        :key="child.id"
        :child="child"
        :photo-url="family.photoUrl(child.photo_path)"
        :checkin="family.activeCheckin(child.id)"
        :busy="busyChildId === child.id"
        @check-in="checkIn(child)"
        @check-out="checkOut(child)"
        @edit="openForm(child)"
      />
      <button
        v-if="!loading || children.length"
        type="button"
        class="focus-ring flex min-h-40 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-primary/30 p-6 text-center text-primary transition hover:bg-primary/5 active:scale-[0.99]"
        @click="openForm()"
      >
        <span class="grid size-12 place-items-center rounded-full bg-primary/10">
          <UIcon
            name="i-lucide-plus"
            class="size-6"
          />
        </span>
        <span class="font-semibold">{{ children.length ? 'Cadastrar outra criança' : 'Cadastrar meu primeiro filho' }}</span>
        <span
          v-if="!children.length"
          class="max-w-xs text-sm text-muted"
        >Nome, data de nascimento e, se quiser, uma foto. Depois a equipe infantil coloca a criança na turma.</span>
      </button>
    </div>

    <p class="mt-6 flex items-start gap-2 text-sm text-muted">
      <UIcon
        name="i-lucide-shield-check"
        class="mt-0.5 size-4 shrink-0 text-primary"
      />
      Os dados das crianças são privados: só os responsáveis, a equipe infantil e a administração conseguem vê-los.
    </p>

    <SementinhasChildForm
      v-model:open="formOpen"
      :child="editingChild"
      :photo-url="family.photoUrl(editingChild?.photo_path)"
      :saving="saving"
      :removing="removing"
      @submit="saveChild"
      @remove="removeChild"
    />

    <SementinhasClassPicker
      v-if="pickerChild"
      v-model:open="pickerOpen"
      :child-name="pickerChild.full_name"
      :classes="pickerChild.classes"
      :busy="busyChildId === pickerChild.id"
      @pick="checkIn(pickerChild, $event)"
    />
  </div>
</template>
