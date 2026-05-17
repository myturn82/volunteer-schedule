import { describe, it, expect } from 'vitest'
import { TIME_SLOTS } from './index'

describe('TIME_SLOTS', () => {
  it('contains 6 slots in correct order', () => {
    expect(TIME_SLOTS).toHaveLength(6)
    expect(TIME_SLOTS[0]).toBe('10-12')
    expect(TIME_SLOTS[5]).toBe('20-22')
  })
})
