const priceFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export function formatPriceInput(value: number): string {
  return priceFormatter.format(value)
}

export function parsePriceInput(value: string): number {
  // numeric(12,2): at most ten whole digits and two decimal digits.
  const digits = value.replace(/\D/g, '').replace(/^0+/, '').slice(0, 12)
  return Number(digits || '0') / 100
}
