import { describe, expect, it } from 'vitest'
import { isOutsideVisibleArea } from '../app/utils/keyboardFocus'

const area = { top: 0, bottom: 400 }

describe('keyboard focus', () => {
  it('keeps a field that is already visible in place', () => {
    expect(isOutsideVisibleArea({ top: 100, bottom: 140 }, area)).toBe(false)
  })

  it('detects a field covered by the keyboard', () => {
    expect(isOutsideVisibleArea({ top: 380, bottom: 420 }, area)).toBe(true)
  })

  it('detects a field too close to the keyboard edge', () => {
    expect(isOutsideVisibleArea({ top: 350, bottom: 390 }, area)).toBe(true)
  })

  it('detects a field scrolled above the visible area', () => {
    expect(isOutsideVisibleArea({ top: -30, bottom: 10 }, area)).toBe(true)
  })
})
