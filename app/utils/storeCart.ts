export interface StoreProduct {
  id: string
  name: string
  description: string | null
  image_path?: string | null
  sale_price: number
  stock_available: number
}

export interface CartItem extends StoreProduct {
  quantity: number
}

export type CartChange
  = | { ok: true, cart: CartItem[] }
    | { ok: false, cart: CartItem[], reason: 'out_of_stock' }

export function cartQuantityOf(cart: readonly CartItem[], productId: string) {
  return cart.find(item => item.id === productId)?.quantity ?? 0
}

export function cartTotal(cart: readonly CartItem[]) {
  return cart.reduce((total, item) => total + item.sale_price * item.quantity, 0)
}

export function cartCount(cart: readonly CartItem[]) {
  return cart.reduce((total, item) => total + item.quantity, 0)
}

/** Define a quantidade de um produto no carrinho; zero ou menos remove o item. */
export function setCartQuantity(cart: readonly CartItem[], product: StoreProduct, quantity: number): CartChange {
  const nextQuantity = Math.floor(quantity)
  if (nextQuantity <= 0) return { ok: true, cart: cart.filter(item => item.id !== product.id) }
  if (nextQuantity > product.stock_available) return { ok: false, cart: [...cart], reason: 'out_of_stock' }

  const exists = cart.some(item => item.id === product.id)
  const nextCart = exists
    ? cart.map(item => item.id === product.id ? { ...item, ...product, quantity: nextQuantity } : item)
    : [...cart, { ...product, quantity: nextQuantity }]
  return { ok: true, cart: nextCart }
}

/** Reaplica o estoque atualizado da loja: remove o que saiu do caixa e limita o que diminuiu. */
export function reconcileCart(cart: readonly CartItem[], products: readonly StoreProduct[]) {
  const byId = new Map(products.map(product => [product.id, product]))
  return cart.flatMap((item) => {
    const product = byId.get(item.id)
    if (!product || product.stock_available <= 0) return []
    return [{ ...item, ...product, quantity: Math.min(item.quantity, product.stock_available) }]
  })
}

const brlFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export function formatBRL(value: number) {
  return brlFormatter.format(value)
}
