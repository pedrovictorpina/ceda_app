export type FinanceKind = 'expense' | 'donation'
export interface FinanceEntry { id: string, entry_date: string, kind: FinanceKind, description: string, amount: number, voided_at: string | null }
export interface FinanceSale { confirmed_at: string, payment_method: string | null, total_amount: number }

export const financePaymentLabels: Record<string, string> = { cash: 'Dinheiro', pix: 'Pix', debit_card: 'Débito', credit_card: 'Crédito' }

/** Wide UTC bounds; filter the returned rows by local civil date after fetching. */
export function financeUtcSearchBounds(start: string, end: string) {
  const first = new Date(`${start}T00:00:00Z`)
  const last = new Date(`${end}T00:00:00Z`)
  first.setUTCDate(first.getUTCDate() - 1)
  last.setUTCDate(last.getUTCDate() + 2)
  return { start: first.toISOString(), end: last.toISOString() }
}

export function saleDate(value: string) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(value))
  const part = (name: string) => parts.find(item => item.type === name)?.value || ''
  return `${part('year')}-${part('month')}-${part('day')}`
}

export function financeSummary(sales: readonly FinanceSale[], entries: readonly FinanceEntry[]) {
  const grouped = new Map<string, { date: string, method: string, cents: number }>()
  for (const sale of sales) {
    const date = saleDate(sale.confirmed_at)
    const method = sale.payment_method || 'não informado'
    const key = `${date}|${method}`
    const row = grouped.get(key) || { date, method, cents: 0 }
    row.cents += Math.round(Number(sale.total_amount) * 100)
    grouped.set(key, row)
  }
  const rows = [...grouped.values()].sort((a, b) => a.date.localeCompare(b.date) || a.method.localeCompare(b.method))
  const active = entries.filter(entry => !entry.voided_at)
  const expenses = active.filter(entry => entry.kind === 'expense')
  const donations = active.filter(entry => entry.kind === 'donation')
  const total = (items: readonly FinanceEntry[]) => items.reduce((sum, item) => sum + Math.round(Number(item.amount) * 100), 0)
  const salesCents = rows.reduce((sum, row) => sum + row.cents, 0)
  const expenseCents = total(expenses)
  const donationCents = total(donations)
  return { rows, expenses, donations, salesCents, expenseCents, donationCents, balanceCents: salesCents + donationCents - expenseCents }
}
