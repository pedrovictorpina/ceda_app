import { reconcileCart, type CartItem, type StoreProduct } from './storeCart'

export const STORE_CART_DRAFT_PREFIX = 'ceda.store-cart.v1:'
const MAX_DRAFT_AGE_MS = 24 * 60 * 60 * 1000

export interface CartDraft {
  ownerId: string
  items: Array<{ id: string, quantity: number }>
  note: string
  updatedAt: number
}

type DraftStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>

/** Apenas identificadores/quantidades; preços e disponibilidade sempre vêm do catálogo. */
export function saveStoreCartDraft(storage: DraftStorage, ownerId: string, cart: readonly CartItem[], note: string, now = Date.now()) {
  if (!ownerId) return
  const key = `${STORE_CART_DRAFT_PREFIX}${ownerId}`
  try {
    if (!cart.length && !note.trim()) return storage.removeItem(key)
    storage.setItem(key, JSON.stringify({
      ownerId,
      items: cart.map(({ id, quantity }) => ({ id, quantity })),
      note: note.slice(0, 500),
      updatedAt: now
    } satisfies CartDraft))
  } catch { /* Armazenamento bloqueado não impede fazer um pedido. */ }
}

export function readStoreCartDraft(storage: DraftStorage, ownerId: string, now = Date.now()): CartDraft | null {
  if (!ownerId) return null
  const key = `${STORE_CART_DRAFT_PREFIX}${ownerId}`
  try {
    const raw: unknown = JSON.parse(storage.getItem(key) || 'null')
    if (!raw || typeof raw !== 'object') return null
    const draft = raw as Partial<CartDraft>
    if (draft.ownerId !== ownerId || typeof draft.updatedAt !== 'number'
      || draft.updatedAt > now || now - draft.updatedAt > MAX_DRAFT_AGE_MS
      || typeof draft.note !== 'string' || !Array.isArray(draft.items)) {
      storage.removeItem(key)
      return null
    }
    const ids = new Set<string>()
    const items = draft.items.filter((item) => {
      if (!item || typeof item.id !== 'string' || !item.id || !Number.isSafeInteger(item.quantity)
        || item.quantity <= 0 || ids.has(item.id)) return false
      ids.add(item.id)
      return true
    })
    return { ownerId, updatedAt: draft.updatedAt, note: draft.note.slice(0, 500), items }
  } catch {
    try {
      storage.removeItem(key)
    } catch { /* Sem acesso ao armazenamento. */ }
    return null
  }
}

export function restoreStoreCartDraft(draft: CartDraft, products: readonly StoreProduct[]) {
  const productsById = new Map(products.map(product => [product.id, product]))
  const items = draft.items.flatMap((item) => {
    const product = productsById.get(item.id)
    return product ? [{ ...product, quantity: item.quantity }] : []
  })
  return reconcileCart(items, products)
}

/** Ao sair/trocar de conta, não deixar observações ou pedidos da conta anterior. */
export function clearOtherStoreCartDrafts(storage: DraftStorage, ownerId: string | null) {
  try {
    const keep = ownerId ? `${STORE_CART_DRAFT_PREFIX}${ownerId}` : null
    const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index))
    for (const key of keys) {
      if (key?.startsWith(STORE_CART_DRAFT_PREFIX) && key !== keep) storage.removeItem(key)
    }
  } catch { /* O app continua operando se sessionStorage estiver indisponível. */ }
}
