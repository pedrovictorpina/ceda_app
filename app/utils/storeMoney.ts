export function parseMoneyInput(value: string): number {
  return Number(value.replace(/\D/g, '') || '0') / 100
}
