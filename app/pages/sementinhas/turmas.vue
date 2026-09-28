<script setup lang="ts">
import type { ChildAlertReason, ChildRecord, ClassFormValue } from '~/types/children'
import type { ActionResult } from '~/composables/useFamilyChildren'
import type { ManagedClass, RosterEntry } from '~/composables/useChildrenClasses'
import { ageInYears, isAgeInRange } from '~/utils/childAge'
import { hasRole } from '~/utils/authorization'

definePageMeta({ middleware: ['auth', 'children-staff'] })
useSeoMeta({ title: 'Turmas infantis' })

const REFRESH_MS = 8000
const tabs = [
  { label: 'Agora na salinha', icon: 'i-lucide-door-open', slot: 'roster' as const },
  { label: 'Turmas', icon: 'i-lucide-school', slot: 'classes' as const }
]

const auth = useAuthStore()
const toast = useToast()
const store = useChildrenClasses()
const { activeClasses, archivedClasses, roster, loading, loadError } = store
const busyId = ref('')
const formOpen = ref(false)
const editingClass = ref<ManagedClass | undefined>()
const savingClass = ref(false)
const managedClassId = ref('')
const manageOpen = ref(false)
const alertEntry = ref<RosterEntry | undefined>()
const alertOpen = ref(false)
const sendingAlert = ref(false)
const showArchived = ref(false)
let refreshTimer: ReturnType<typeof setInterval> | undefined

const isAdministrator = computed(() => hasRole(auth.profile, 'administrator'))
// Administrators follow every classroom; teachers see the classes they run.
const myClasses = computed(() => isAdministrator.value ? activeClasses.value : activeClasses.value.filter(store.teaches))
const managedClass = computed(() => store.classes.value.find(item => item.id === managedClassId.value))
const rosterTotal = computed(() => roster.value.length)

function entriesFor(item: ManagedClass) {
  return roster.value.filter(entry => entry.class_id === item.id)
}

function alertFor(checkinId: string) {
  return store.alertSummaries.value.get(checkinId)
}

function report(result: ActionResult, success: string, description?: string) {
  if (!result.ok) {
    toast.add({ title: 'Não deu certo', description: result.message, color: 'error', icon: 'i-lucide-circle-alert' })
    return false
  }
  toast.add({ title: success, description, color: 'success', icon: 'i-lucide-circle-check' })
  return true
}

async function run(id: string, action: () => Promise<ActionResult>, success: string, description?: string) {
  busyId.value = id
  const result = await action()
  busyId.value = ''
  return report(result, success, description)
}

function openClassForm(item?: ManagedClass) {
  editingClass.value = item
  formOpen.value = true
}

async function saveClass(form: ClassFormValue) {
  savingClass.value = true
  const result = await store.saveClass(form, editingClass.value)
  savingClass.value = false
  if (report(result, editingClass.value ? 'Turma atualizada' : 'Turma criada', editingClass.value ? undefined : 'Você já aparece como professor(a) desta turma.')) {
    formOpen.value = false
  }
}

function openManage(item: ManagedClass) {
  managedClassId.value = item.id
  manageOpen.value = true
}

function enroll(child: ChildRecord) {
  const item = managedClass.value
  if (!item) return
  const age = ageInYears(child.birth_date)
  const outside = age !== null && !isAgeInRange(age, item.min_age, item.max_age)
  void run(child.id, () => store.enroll(item, child), `${child.full_name.split(' ')[0]} entrou na turma`,
    outside ? 'Atenção: a idade está fora da faixa da turma.' : undefined)
}

function unenroll(child: ChildRecord) {
  const item = managedClass.value
  if (item) void run(child.id, () => store.unenroll(item, child), 'Criança retirada da turma')
}

function openAlert(entry: RosterEntry) {
  alertEntry.value = entry
  alertOpen.value = true
}

async function sendAlert(payload: { reason: ChildAlertReason, note: string }) {
  if (!alertEntry.value) return
  sendingAlert.value = true
  const result = await store.sendAlert(alertEntry.value.id, payload.reason, payload.note)
  sendingAlert.value = false
  if (report(result, 'Alerta enviado', 'Os responsáveis foram avisados no aplicativo.')) alertOpen.value = false
}

function checkOut(entry: RosterEntry) {
  void run(entry.id, () => store.checkOut(entry.id), `Saída de ${entry.child.full_name.split(' ')[0]} registrada`)
}

onMounted(() => {
  // A failed refresh is not fatal: RLS still decides and the load reports errors.
  void store.ensureFreshRoles().catch(() => undefined).finally(() => store.load())
  refreshTimer = setInterval(() => {
    const idle = !loading.value && !busyId.value && !savingClass.value && !sendingAlert.value
    if (document.visibilityState === 'visible' && idle) void store.load(true)
  }, REFRESH_MS)
})
onUnmounted(() => {
  if (refreshTimer) clearInterval(refreshTimer)
})
</script>

<template>
  <div>
    <PageIntro
      title="Turmas infantis"
      description="Acompanhe quem está na salinha, chame os responsáveis e organize as turmas do Sementinhas."
      icon="i-lucide-school"
    />

    <UAlert
      v-if="loadError"
      class="mb-5"
      color="warning"
      variant="subtle"
      icon="i-lucide-wifi-off"
      :description="loadError"
    />

    <UTabs
      :items="tabs"
      class="w-full"
    >
      <template #roster>
        <div class="space-y-4 pt-4">
          <div class="flex items-center justify-between gap-3">
            <p class="text-sm text-muted">
              {{ rosterTotal === 1 ? '1 criança na salinha' : `${rosterTotal} crianças na salinha` }} {{ isAdministrator ? 'em todas as turmas' : 'nas suas turmas' }}. Atualiza sozinho.
            </p>
            <UButton
              color="neutral"
              variant="ghost"
              icon="i-lucide-refresh-cw"
              label="Atualizar"
              class="min-h-11 shrink-0 rounded-full"
              :loading="loading"
              @click="store.load()"
            />
          </div>
          <template v-if="loading && !store.classes.value.length">
            <USkeleton
              v-for="index in 2"
              :key="index"
              class="h-40 rounded-2xl"
            />
          </template>
          <SementinhasRoster
            v-for="item in myClasses"
            :key="item.id"
            :item="item"
            :entries="entriesFor(item)"
            :photo-url="store.photoUrl"
            :alert-for="alertFor"
            :busy-id="busyId"
            @alert="openAlert"
            @check-out="checkOut"
          />
          <div
            v-if="!loading && !myClasses.length"
            class="rounded-2xl border border-dashed border-default p-6 text-center"
          >
            <p class="font-semibold">
              Você ainda não participa de nenhuma turma
            </p>
            <p class="mt-1 text-sm text-muted">
              Na aba Turmas, crie uma turma ou toque em Participar para ver a lista da salinha.
            </p>
          </div>
        </div>
      </template>

      <template #classes>
        <div class="space-y-4 pt-4">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <p class="text-sm text-muted">
              A faixa de idade é a descrição da turma. Crianças fora da faixa podem ser adicionadas com aviso.
            </p>
            <UButton
              icon="i-lucide-plus"
              label="Nova turma"
              class="min-h-11 rounded-full"
              @click="openClassForm()"
            />
          </div>
          <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <SementinhasClassItem
              v-for="item in activeClasses"
              :key="item.id"
              :item="item"
              :teaches="store.teaches(item)"
              :busy="busyId === item.id"
              @edit="openClassForm(item)"
              @manage="openManage(item)"
              @join="run(item.id, () => store.joinClass(item), 'Você entrou na turma')"
              @leave="run(item.id, () => store.leaveClass(item), 'Você saiu da turma')"
              @archive="run(item.id, () => store.setArchived(item, true), 'Turma arquivada')"
              @restore="run(item.id, () => store.setArchived(item, false), 'Turma reativada')"
            />
          </div>
          <p
            v-if="!loading && !activeClasses.length"
            class="rounded-2xl border border-dashed border-default p-6 text-center text-sm text-muted"
          >
            Nenhuma turma ativa. Crie a primeira, por exemplo “Berçário · de 0 a 2 anos”.
          </p>
          <div v-if="archivedClasses.length">
            <UButton
              color="neutral"
              variant="ghost"
              :icon="showArchived ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
              :label="`Turmas arquivadas (${archivedClasses.length})`"
              class="min-h-11 rounded-full"
              @click="showArchived = !showArchived"
            />
            <div
              v-if="showArchived"
              class="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-3"
            >
              <SementinhasClassItem
                v-for="item in archivedClasses"
                :key="item.id"
                :item="item"
                :teaches="store.teaches(item)"
                :busy="busyId === item.id"
                @restore="run(item.id, () => store.setArchived(item, false), 'Turma reativada')"
              />
            </div>
          </div>
        </div>
      </template>
    </UTabs>

    <SementinhasClassForm
      v-model:open="formOpen"
      :item="editingClass"
      :saving="savingClass"
      @submit="saveClass"
    />

    <SementinhasClassChildren
      v-if="managedClass"
      v-model:open="manageOpen"
      :item="managedClass"
      :photo-url="store.photoUrl"
      :search="store.searchChildren"
      :busy-child-id="busyId"
      @enroll="enroll"
      @unenroll="unenroll"
    />

    <SementinhasAlertComposer
      v-model:open="alertOpen"
      :child-name="alertEntry?.child.full_name ?? ''"
      :sending="sendingAlert"
      @send="sendAlert"
    />
  </div>
</template>
