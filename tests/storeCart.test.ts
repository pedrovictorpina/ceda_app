import { describe, expect, it } from 'vitest'
import { cartCount, cartQuantityOf, cartTotal, reconcileCart, setCartQuantity, type CartItem, type StoreProduct } from '../app/utils/storeCart'

const water: StoreProduct = { id: 'water', name: 'Água', description: null, sale_price: 3, stock_available: 2 }
const cake: StoreProduct = { id: 'cake', name: 'Bolo', description: 'Fatia', sale_price: 7.5, stock_available: 10 }

describe('store cart', () => {
  it('adds a product that is not in the cart yet', () => {
    const result = setCartQuantity([], water, 1)
    expect(result.ok).toBe(true)
    expect(result.cart).toEqual([{ ...water, quantity: 1 }])
  })

  it('updates quantity without mutating the previous cart', () => {
    const cart: CartItem[] = [{ ...cake, quantity: 1 }]
    const result = setCartQuantity(cart, cake, 3)
    expect(result.cart[0]?.quantity).toBe(3)
    expect(cart[0]?.quantity).toBe(1)
  })

  it('refuses quantities above the available stock', () => {
    const cart: CartItem[] = [{ ...water, quantity: 2 }]
    const result = setCartQuantity(cart, water, 3)
    expect(result).toMatchObject({ ok: false, reason: 'out_of_stock' })
    expect(result.cart).toEqual(cart)
  })

  it('removes the item when quantity reaches zero', () => {
    const cart: CartItem[] = [{ ...water, quantity: 1 }, { ...cake, quantity: 2 }]
    expect(setCartQuantity(cart, water, 0).cart).toEqual([{ ...cake, quantity: 2 }])
  })

  it('sums totals, counts and per-product quantity', () => {
    const cart: CartItem[] = [{ ...water, quantity: 2 }, { ...cake, quantity: 1 }]
    expect(cartTotal(cart)).toBe(13.5)
    expect(cartCount(cart)).toBe(3)
    expect(cartQuantityOf(cart, 'cake')).toBe(1)
    expect(cartQuantityOf(cart, 'missing')).toBe(0)
  })

  it('reconciles the cart with refreshed stock', () => {
    const cart: CartItem[] = [{ ...water, quantity: 2 }, { ...cake, quantity: 4 }]
    const refreshed = [{ ...cake, stock_available: 3, sale_price: 8 }]
    expect(reconcileCart(cart, refreshed)).toEqual([{ ...cake, stock_available: 3, sale_price: 8, quantity: 3 }])
  })
})
