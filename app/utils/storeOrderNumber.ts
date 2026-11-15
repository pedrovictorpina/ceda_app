export interface StoreOrderNumber {
  order_number: number
  daily_order_number?: number | null
  daily_order_date?: string | null
}

// Legacy orders keep their original global number; new numbers identify their cash day.
export function displayOrderNumber(order: StoreOrderNumber): string {
  if (order.daily_order_number != null && order.daily_order_date) {
    const [year, month, day] = order.daily_order_date.split('-')
    return `#${order.daily_order_number} · caixa ${day}/${month}/${year}`
  }
  return `#${order.order_number} · anterior`
}
