import { describe, expect, it } from 'vitest'
import { clearOtherStoreCartDrafts, readStoreCartDraft, restoreStoreCartDraft, saveStoreCartDraft, STORE_CART_DRAFT_PREFIX } from '../app/utils/storeCartDraft'
import type { CartItem } from '../app/utils/storeCart'

function memoryStorage() {
  const entries = new Map<string, string>()
  return {
    get length() { return entries.size },
    key: (index: number) => [...entries.keys()][index] ?? null,
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => { entries.set(key, value) },
    removeItem: (key: string) => { entries.delete(key) }
  }
}

const product = { id: 'water', name: 'Água', description: null, sale_price: 5, stock_available: 5 }
const cart: CartItem[] = [{ ...product, quantity: 3 }]

describe('store cart drafts', () => {
  it('restores only the owner draft across page remounts and uses current prices and stock', () => {
    const storage = memoryStorage()
    saveStoreCartDraft(storage, 'account-a', cart, 'Sem gelo', 100)
    expect(readStoreCartDraft(storage, 'account-b', 200)).toBeNull()
    const draft = readStoreCartDraft(storage, 'account-a', 200)!
    expect(draft.note).toBe('Sem gelo')
    expect(restoreStoreCartDraft(draft, [{ ...product, sale_price: 7, stock_available: 2 }])).toEqual([{ ...product, sale_price: 7, stock_available: 2, quantity: 2 }])
    expect(restoreStoreCartDraft(draft, [])).toEqual([])
    expect(storage.getItem(`${STORE_CART_DRAFT_PREFIX}account-a`)).not.toContain('sale_price')
  })

  it('removes prior account drafts on switch and all drafts on logout, preserving other preferences', () => {
    const storage = memoryStorage()
    saveStoreCartDraft(storage, 'account-a', cart, 'A', 100)
    saveStoreCartDraft(storage, 'account-b', cart, 'B', 100)
    storage.setItem('color-mode', 'dark')
    clearOtherStoreCartDrafts(storage, 'account-b')
    expect(readStoreCartDraft(storage, 'account-a', 200)).toBeNull()
    expect(readStoreCartDraft(storage, 'account-b', 200)?.note).toBe('B')
    clearOtherStoreCartDrafts(storage, null)
    expect(readStoreCartDraft(storage, 'account-b', 200)).toBeNull()
    expect(storage.getItem('color-mode')).toBe('dark')
  })

  it('expires drafts and rejects forged owners, invalid quantities and duplicated products', () => {
    const storage = memoryStorage()
    const key = `${STORE_CART_DRAFT_PREFIX}account-a`
    saveStoreCartDraft(storage, 'account-a', cart, '', 100)
    expect(readStoreCartDraft(storage, 'account-a', 100 + 24 * 60 * 60 * 1000 + 1)).toBeNull()
    storage.setItem(key, JSON.stringify({ ownerId: 'account-b', updatedAt: 100, items: [], note: '' }))
    expect(readStoreCartDraft(storage, 'account-a', 200)).toBeNull()
    storage.setItem(key, JSON.stringify({ ownerId: 'account-a', updatedAt: 100, note: '', items: [{ id: 'water', quantity: -2 }, { id: 'water', quantity: 1.5 }, { id: 'water', quantity: 2 }, { id: 'water', quantity: 4 }, { id: 'cake', quantity: null }] }))
    expect(readStoreCartDraft(storage, 'account-a', 200)?.items).toEqual([{ id: 'water', quantity: 2 }])
  })

  it('cleans successful/cleared orders and tolerates unavailable or corrupt storage', () => {
    const storage = memoryStorage()
    saveStoreCartDraft(storage, 'account-a', cart, 'Teste', 100)
    saveStoreCartDraft(storage, 'account-a', [], '', 200)
    expect(readStoreCartDraft(storage, 'account-a', 200)).toBeNull()
    storage.setItem(`${STORE_CART_DRAFT_PREFIX}account-a`, 'broken-json')
    expect(readStoreCartDraft(storage, 'account-a')).toBeNull()
    const unavailable = { ...storage, setItem() {
      throw new Error('blocked')
    } }
    expect(() => saveStoreCartDraft(unavailable, 'account-a', cart, '')).not.toThrow()
  })
})
