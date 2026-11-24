<script setup lang="ts">
import { Capacitor } from '@capacitor/core'
import { Directory, Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'
import { financePaymentLabels, financeSummary, financeUtcSearchBounds, saleDate, type FinanceEntry, type FinanceKind, type FinanceSale } from '~/utils/storeFinance'
import { randomId } from '~/utils/randomId'

const props = withDefaults(defineProps<{ start: string, end: string, cashDayId?: string, mode?: 'summary' | 'entries' }>(), { mode: 'summary' })
const auth = useAuthStore()
const sales = ref<FinanceSale[]>([])
const entries = ref<FinanceEntry[]>([])
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const notice = ref('')
const kind = ref<FinanceKind>('expense')
const entryDate = ref(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()))
const description = ref('')
const amount = ref<number | null>(null)
const pendingVoid = ref<string | null>(null)
const editingEntry = ref<string | null>(null)
const showSales = ref(false)
const showEntryForm = ref(false)
const showEntries = ref(false)
type PendingEntry = { id: string, entry_date: string, kind: FinanceKind, description: string, amount: number, created_by: string }
const pendingEntry = ref<PendingEntry | null>(null)
const entryStorageKey = computed(() => `ceda-finance-entry-${auth.profile?.id}`)
const summary = computed(() => financeSummary(sales.value, entries.value))
const ready = ref(false)
const money = (cents: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
const displayDate = (date: string) => date.split('-').reverse().join('/')
const rows = computed(() => {
  const days = new Map<string, number>()
  for (const row of summary.value.rows) days.set(row.date, (days.get(row.date) || 0) + row.cents)
  return summary.value.rows.map((row, index, all) => ({ ...row, dayTotal: all[index + 1]?.date === row.date ? null : days.get(row.date) || 0 }))
})
let loadVersion = 0

async function load() {
  const { $supabase } = useNuxtApp()
  const version = ++loadVersion
  if (!$supabase || !props.start || !props.end || props.start > props.end) {
    ready.value = false
    loading.value = false
    error.value = 'Informe um período válido para o controle financeiro.'
    return
  }
  loading.value = true
  ready.value = false
  error.value = ''
  try {
    const nextSales: FinanceSale[] = []
    const nextEntries: FinanceEntry[] = []
    const bounds = financeUtcSearchBounds(props.start, props.end)
    for (let offset = 0; ; offset += 500) {
      let query = $supabase.from('store_orders').select('confirmed_at,payment_method,total_amount').in('status', ['ready_for_pickup', 'fulfilled']).not('confirmed_at', 'is', null).order('confirmed_at').order('id').range(offset, offset + 499)
      query = props.cashDayId ? query.eq('cash_day_id', props.cashDayId) : query.gte('confirmed_at', bounds.start).lt('confirmed_at', bounds.end)
      const { data, error: queryError } = await query
      if (queryError) throw queryError
      nextSales.push(...(data as FinanceSale[]).filter(sale => props.cashDayId || (saleDate(sale.confirmed_at) >= props.start && saleDate(sale.confirmed_at) <= props.end)))
      if (data.length < 500) break
    }
    for (let offset = 0; ; offset += 500) {
      const { data, error: queryError } = await $supabase.from('store_financial_entries').select('id,entry_date,kind,description,amount,voided_at').gte('entry_date', props.start).lte('entry_date', props.end).order('entry_date').order('id').range(offset, offset + 499)
      if (queryError) throw queryError
      nextEntries.push(...(data as FinanceEntry[]))
      if (data.length < 500) break
    }
    if (version !== loadVersion) return
    sales.value = nextSales
    entries.value = nextEntries
    ready.value = true
  } catch {
    if (version !== loadVersion) return
    error.value = 'Não foi possível carregar o controle financeiro completo. Confira a conexão e a atualização do banco.'
  } finally {
    if (version === loadVersion) loading.value = false
  }
}

async function saveEntry() {
  const { $supabase } = useNuxtApp()
  if (!$supabase || !auth.profile || saving.value) return
  if (editingEntry.value) {
    if (!description.value.trim() || !entryDate.value || !amount.value || amount.value <= 0) return
    saving.value = true
    error.value = ''
    const { data, error: updateError } = await $supabase.from('store_financial_entries').update({ entry_date: entryDate.value, kind: kind.value, description: description.value.trim(), amount: amount.value }).eq('id', editingEntry.value).select('id').maybeSingle()
    saving.value = false
    if (updateError || !data) {
      error.value = 'Não foi possível atualizar o lançamento. Confira os dados e tente novamente.'
      return
    }
    showEntryForm.value = false
    editingEntry.value = null
    description.value = ''
    amount.value = null
    notice.value = 'Lançamento atualizado.'
    await load()
    return
  }
  if (!pendingEntry.value) {
    if (!description.value.trim() || !entryDate.value || !amount.value || amount.value <= 0) return
    pendingEntry.value = { id: randomId(), entry_date: entryDate.value, kind: kind.value, description: description.value.trim(), amount: amount.value, created_by: auth.profile.id }
    try {
      sessionStorage.setItem(entryStorageKey.value, JSON.stringify(pendingEntry.value))
    } catch {
      pendingEntry.value = null
      error.value = 'Não foi possível guardar a tentativa neste aparelho.'
      return
    }
  }
  saving.value = true
  error.value = ''
  const { error: saveError } = await $supabase.from('store_financial_entries').insert(pendingEntry.value)
  let saved = !saveError
  if (saveError?.code === '23505') {
    const existing = await $supabase.from('store_financial_entries').select('id').eq('id', pendingEntry.value.id).eq('created_by', auth.profile.id).maybeSingle()
    saved = Boolean(existing.data)
  }
  saving.value = false
  if (!saved) {
    if (saveError?.code && /^[0-9A-Z]{5}$/.test(saveError.code) && saveError.code !== '23505') {
      sessionStorage.removeItem(entryStorageKey.value)
      pendingEntry.value = null
      error.value = 'O lançamento foi recusado. Confira os dados e tente novamente.'
    } else error.value = 'Resposta não confirmada. Tente novamente para verificar a mesma tentativa sem duplicar o lançamento.'
  } else {
    sessionStorage.removeItem(entryStorageKey.value)
    pendingEntry.value = null
    description.value = ''
    amount.value = null
    notice.value = entryDate.value < props.start || entryDate.value > props.end
      ? 'Lançamento registrado fora do período exibido. Altere o período para consultá-lo.'
      : 'Lançamento registrado.'
    showEntryForm.value = false
    await load()
  }
}

function editEntry(entry: FinanceEntry) {
  if (pendingEntry.value) return
  editingEntry.value = entry.id
  kind.value = entry.kind
  entryDate.value = entry.entry_date
  description.value = entry.description
  amount.value = Number(entry.amount)
  error.value = ''
  showEntryForm.value = true
}

function newEntry() {
  editingEntry.value = null
  description.value = ''
  amount.value = null
  showEntryForm.value = true
}

async function deleteEntry(id: string) {
  const { $supabase } = useNuxtApp()
  if (!$supabase || saving.value) return
  saving.value = true
  error.value = ''
  const { data, error: deleteError } = await $supabase.from('store_financial_entries').delete().eq('id', id).select('id').maybeSingle()
  saving.value = false
  pendingVoid.value = null
  if (deleteError || !data) error.value = 'Não foi possível excluir. Atualize e tente novamente.'
  else {
    notice.value = 'Lançamento excluído definitivamente.'
    await load()
  }
}

const csvCell = (value: string | number) => typeof value === 'number'
  ? value.toFixed(2).replace('.', ',')
  : `"${value.replace(/^(?:\s*[=+\-@]|[\t\r])/, '\'$&').replaceAll('"', '""')}"`
async function shareFile(blob: Blob, fileName: string, title: string) {
  if (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('Filesystem') && Capacitor.isPluginAvailable('Share')) {
    const data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result).split(',')[1] || '')
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(blob)
    })
    const written = await Filesystem.writeFile({ path: fileName, data, directory: Directory.Cache })
    await Share.share({ title, files: [written.uri], dialogTitle: title })
  } else {
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
}

function exportRows() {
  const count = Math.max(rows.value.length, summary.value.expenses.length, summary.value.donations.length)
  const output: Array<Array<string | number>> = [['Data de entrada', 'Meio de pagamento', 'Valor de entrada', 'Total do dia', 'Data da saída', 'Descrição da saída', 'Valor da saída', 'Data da doação', 'Nome / doação', 'Valor da doação']]
  const number = (cents: number) => cents / 100
  for (let i = 0; i < count; i++) {
    const sale = rows.value[i]
    const expense = summary.value.expenses[i]
    const donation = summary.value.donations[i]
    output.push([sale ? displayDate(sale.date) : '', sale ? financePaymentLabels[sale.method] || sale.method : '', sale ? number(sale.cents) : '', sale?.dayTotal != null ? number(sale.dayTotal) : '', expense ? displayDate(expense.entry_date) : '', expense?.description || '', expense ? number(Math.round(Number(expense.amount) * 100)) : '', donation ? displayDate(donation.entry_date) : '', donation?.description || '', donation ? number(Math.round(Number(donation.amount) * 100)) : ''])
  }
  output.push(['TOTAIS', '', number(summary.value.salesCents), '', '', '', number(summary.value.expenseCents), '', '', number(summary.value.donationCents)])
  output.push(['SALDO FINAL (entradas + doações - saídas)', number(summary.value.balanceCents)])
  return output
}

async function exportCsv() {
  try {
    const header = [[`CEDA · Controle financeiro · ${displayDate(props.start)} a ${displayDate(props.end)}`]]
    const csv = `\uFEFF${[...header, ...exportRows()].map(row => row.map(csvCell).join(';')).join('\r\n')}`
    await shareFile(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `ceda-financeiro-${props.start}-${props.end}.csv`, 'Controle financeiro CEDA')
  } catch { error.value = 'Não foi possível compartilhar a planilha.' }
}

async function exportImage() {
  const table = exportRows()
  if (table.length > 253) {
    error.value = 'Para exportar a imagem completa, selecione um período com até 250 linhas. A planilha aceita períodos maiores.'
    return
  }
  try {
    const canvas = document.createElement('canvas')
    canvas.width = 1800
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas indisponível')
    const widths = [145, 195, 150, 150, 145, 195, 150, 145, 190, 150]
    ctx.font = '17px sans-serif'
    const wrap = (text: string, width: number) => {
      const lines: string[] = []
      let line = ''
      for (const character of text) {
        if (line && ctx.measureText(line + character).width > width - 12) {
          lines.push(line)
          line = ''
        }
        line += character
      }
      lines.push(line)
      return lines
    }
    const wrapped = table.map((row, index) => widths.map((width, column) => {
      const value = row[column] ?? ''
      const text = typeof value === 'number' ? money(Math.round(value * 100)) : value
      return wrap(text, index === table.length - 1 && column === 0 ? widths[0]! + widths[1]! + widths[2]! : width)
    }))
    const heights = wrapped.map(row => Math.max(36, 12 + Math.max(...row.map(lines => lines.length)) * 22))
    canvas.height = 145 + heights.reduce((sum, height) => sum + height, 0)
    if (canvas.height > 30000) throw new Error('Período muito extenso')
    ctx.fillStyle = '#151519'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = '#f97316'
    ctx.fillRect(0, 0, canvas.width, 12)
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 34px sans-serif'
    ctx.fillText('CEDA · CONTROLE FINANCEIRO', 28, 58)
    ctx.font = '22px sans-serif'
    ctx.fillText(`${displayDate(props.start)} a ${displayDate(props.end)}`, 28, 96)
    let y = 115
    table.forEach((row, index) => {
      ctx.fillStyle = index === 0 || index >= table.length - 2 ? '#9a4605' : index % 2 ? '#29292e' : '#202025'
      ctx.fillRect(18, y, 1764, heights[index]!)
      let x = 26
      ctx.fillStyle = '#fff'
      ctx.font = index === 0 ? 'bold 16px sans-serif' : '17px sans-serif'
      widths.forEach((width, column) => {
        if (index === table.length - 1 && column === 1) x += widths[1]! + widths[2]!
        for (const [lineIndex, line] of (wrapped[index]?.[column] || []).entries()) ctx.fillText(line, x, y + 23 + lineIndex * 22)
        x += width
      })
      y += heights[index]!
    })
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Imagem indisponível')), 'image/png'))
    await shareFile(blob, `ceda-financeiro-${props.start}-${props.end}.png`, 'Controle financeiro CEDA')
  } catch { error.value = 'Não foi possível compartilhar a imagem.' }
}

onMounted(() => {
  try {
    pendingEntry.value = JSON.parse(sessionStorage.getItem(entryStorageKey.value) || 'null') as PendingEntry | null
  } catch {
    pendingEntry.value = null
  }
})
watch(() => [props.start, props.end, props.cashDayId], () => {
  void load()
}, { immediate: true })
</script>

<template>
  <section
    class="mt-6 rounded-2xl border border-default bg-default p-4 sm:p-5"
    aria-labelledby="finance-title"
  >
    <template v-if="mode === 'summary'">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2
            id="finance-title"
            class="text-xl font-bold"
          >
            Resumo financeiro
          </h2><p class="mt-1 text-sm text-muted">
            {{ cashDayId ? 'Vendas deste caixa. Doações e saídas correspondem à data do caixa.' : 'Vendas confirmadas, doações e saídas no período escolhido.' }}
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          <UButton
            label="Planilha financeira"
            icon="i-lucide-sheet"
            class="min-h-11"
            :disabled="!ready || loading"
            @click="exportCsv"
          />
          <UButton
            label="Imagem do financeiro"
            icon="i-lucide-image-down"
            color="neutral"
            variant="outline"
            class="min-h-11"
            :disabled="!ready || loading"
            @click="exportImage"
          />
        </div>
      </div>
      <UAlert
        v-if="error"
        color="error"
        variant="subtle"
        class="mt-4"
        :description="error"
      />
      <UAlert
        v-if="notice"
        color="success"
        variant="subtle"
        class="mt-4"
        :description="notice"
      />
      <div
        v-if="ready"
        class="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4"
      >
        <div
          v-for="item in [{ label: 'Vendas', value: summary.salesCents }, { label: 'Doações', value: summary.donationCents }, { label: 'Saídas', value: summary.expenseCents }, { label: 'Saldo do período', value: summary.balanceCents }]"
          :key="item.label"
          class="rounded-xl bg-elevated p-3"
        >
          <p class="text-xs text-muted">
            {{ item.label }}
          </p><p class="mt-1 font-bold">
            {{ money(item.value) }}
          </p>
        </div>
      </div>
      <p class="mt-3 text-xs text-muted">
        Saldo = vendas confirmadas + doações − saídas. Não inclui saldo anterior. Compras de estoque devem ser registradas como saída. As vendas usam a data de confirmação em São Paulo; doações e saídas usam a data informada.
      </p>
      <div
        v-if="ready && rows.length"
        class="mt-4"
      >
        <UButton
          :label="showSales ? 'Ocultar vendas por data' : 'Ver vendas por data'"
          color="neutral"
          variant="outline"
          class="min-h-11"
          :aria-expanded="showSales"
          @click="showSales = !showSales"
        />
        <div
          v-if="showSales"
          class="mt-3 space-y-2"
        >
          <div
            v-for="row in rows"
            :key="`${row.date}-${row.method}`"
            class="rounded-xl border border-default p-3 text-sm"
          >
            <p class="font-medium">
              {{ displayDate(row.date) }} · {{ financePaymentLabels[row.method] || row.method }} · {{ money(row.cents) }}
            </p>
            <p
              v-if="row.dayTotal !== null"
              class="mt-1 text-muted"
            >
              Total do dia: {{ money(row.dayTotal) }}
            </p>
          </div>
        </div>
      </div>
    </template>
    <template v-else>
      <h2
        id="finance-title"
        class="text-lg font-semibold"
      >
        Saídas e doações
      </h2>
      <UAlert
        v-if="error"
        color="error"
        variant="subtle"
        class="mt-4"
        :description="error"
      />
      <UAlert
        v-if="notice"
        color="success"
        variant="subtle"
        class="mt-4"
        :description="notice"
      />
      <UAlert
        v-if="pendingEntry"
        class="mt-4"
        color="warning"
        variant="subtle"
        description="Há um lançamento aguardando confirmação. Tente novamente antes de registrar outro."
      />
      <UButton
        class="mt-4 min-h-11"
        label="Registrar saída ou doação"
        icon="i-lucide-plus"
        color="neutral"
        variant="outline"
        @click="newEntry"
      />
      <UModal
        v-model:open="showEntryForm"
        :title="editingEntry ? 'Editar lançamento' : 'Saída ou doação'"
        description="Informe os dados do lançamento."
        :dismissible="!saving"
        :close="!saving"
        :ui="{ content: 'max-h-[calc(100dvh-2rem)]', body: 'overflow-y-auto' }"
      >
        <template #body>
          <UAlert
            v-if="error"
            color="error"
            variant="subtle"
            :description="error"
          />
          <UForm
            :state="{ kind, entryDate, description, amount }"
            class="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
            @submit="saveEntry"
          >
            <UFormField label="Tipo">
              <USelect
                v-model="kind"
                :items="[{ label: 'Saída', value: 'expense' }, { label: 'Doação', value: 'donation' }]"
                :disabled="Boolean(pendingEntry)"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Data">
              <UInput
                v-model="entryDate"
                type="date"
                :disabled="Boolean(pendingEntry)"
                required
                class="w-full"
              />
            </UFormField>
            <UFormField :label="kind === 'expense' ? 'Descrição da saída' : 'Nome / doação'">
              <UInput
                v-model="description"
                maxlength="160"
                :disabled="Boolean(pendingEntry)"
                required
                class="w-full"
              />
            </UFormField>
            <UFormField label="Valor (R$)">
              <UInput
                v-model.number="amount"
                type="number"
                min="0.01"
                step="0.01"
                :disabled="Boolean(pendingEntry)"
                required
                class="w-full"
              />
            </UFormField>
            <UButton
              type="submit"
              :label="editingEntry ? 'Salvar alterações' : pendingEntry ? 'Confirmar tentativa' : kind === 'expense' ? 'Registrar saída' : 'Registrar doação'"
              icon="i-lucide-plus"
              class="min-h-11"
              :loading="saving"
              :disabled="!ready || loading"
            />
          </UForm>
        </template>
      </UModal>
      <div
        v-if="ready && entries.length"
        class="mt-5 space-y-2"
      >
        <UButton
          :label="`${showEntries ? 'Ocultar' : 'Ver'} lançamentos do período (${entries.length})`"
          color="neutral"
          variant="ghost"
          class="min-h-11"
          :aria-expanded="showEntries"
          @click="showEntries = !showEntries"
        />
        <article
          v-for="entry in (showEntries ? entries : [])"
          :key="entry.id"
          class="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-default p-3"
        >
          <div>
            <p class="font-medium">
              {{ entry.kind === 'expense' ? 'Saída' : 'Doação' }} · {{ entry.description }}
            </p><p class="text-sm text-muted">
              {{ displayDate(entry.entry_date) }} · {{ money(Math.round(Number(entry.amount) * 100)) }}{{ entry.voided_at ? ' · Estornado' : '' }}
            </p>
          </div>
          <div
            v-if="pendingVoid !== entry.id"
            class="flex flex-wrap justify-end gap-2"
          >
            <UButton
              label="Editar"
              color="neutral"
              variant="outline"
              :disabled="Boolean(pendingEntry) || saving"
              @click="editEntry(entry)"
            />
            <UButton
              label="Excluir"
              color="error"
              variant="outline"
              :disabled="saving"
              @click="pendingVoid = entry.id"
            />
          </div>
          <div
            v-else
            class="flex flex-wrap justify-end gap-2"
          >
            <p class="w-full text-sm text-error">
              Excluir definitivamente este lançamento?
            </p>
            <UButton
              label="Confirmar exclusão"
              color="error"
              :loading="saving"
              @click="deleteEntry(entry.id)"
            />
            <UButton
              label="Cancelar"
              color="neutral"
              variant="ghost"
              :disabled="saving"
              @click="pendingVoid = null"
            />
          </div>
        </article>
      </div>
    </template>
  </section>
</template>
