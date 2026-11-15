import { describe, expect, it } from 'vitest'
import { randomId } from '../app/utils/randomId'

describe('randomId', () => {
  it('creates distinct RFC 4122 version 4 identifiers', () => {
    const first = randomId()
    expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    expect(randomId()).not.toBe(first)
  })
})
