import { describe, it, expect } from 'vitest'
import { getCellState } from './cellState'
import type { Assignment, SlotSetting, ScheduleRule, DateOverride } from '../types'

const baseRules: ScheduleRule[] = [
  { id: '1', day_of_week: 1, time_slot: '10-12', is_open: true },
  { id: '2', day_of_week: 1, time_slot: '20-22', is_open: false },
  { id: '3', day_of_week: 2, time_slot: '20-22', is_open: true },
]
const baseSettings: SlotSetting[] = [
  { id: '1', time_slot: '10-12', max_capacity: 2, updated_by: null },
]
const noOverrides: DateOverride[] = []
const noAssignments: Assignment[] = []

describe('getCellState', () => {
  it('returns isBreaktime=true for 12-13 slot', () => {
    // 2026-04-06은 월요일
    const state = getCellState(6, '12-13', 2026, 4, baseRules, baseSettings, noOverrides, noAssignments)
    expect(state.isBreaktime).toBe(true)
    expect(state.isClosed).toBe(true)
  })

  it('returns isClosed=true for Sunday', () => {
    // 2026-04-05는 일요일
    const state = getCellState(5, '10-12', 2026, 4, baseRules, baseSettings, noOverrides, noAssignments)
    expect(state.isHoliday).toBe(true)
    expect(state.isClosed).toBe(true)
  })

  it('returns isClosed=true for 월요일 20-22', () => {
    const state = getCellState(6, '20-22', 2026, 4, baseRules, baseSettings, noOverrides, noAssignments)
    expect(state.isClosed).toBe(true)
    expect(state.isHoliday).toBe(false)
  })

  it('returns isNightShift=true for 20-22 slot on 화요일', () => {
    const state = getCellState(7, '20-22', 2026, 4, baseRules, baseSettings, noOverrides, noAssignments)
    expect(state.isNightShift).toBe(true)
    expect(state.isClosed).toBe(false)
  })

  it('returns isFull=true when assignments >= maxCapacity', () => {
    const assignments: Assignment[] = [
      { id: 'a1', year: 2026, month: 4, day: 6, time_slot: '10-12', volunteer_name: '홍길동', note: null, user_id: 'u1', created_at: '', volunteer_type: 'volunteer', time_sub: null, color: null },
      { id: 'a2', year: 2026, month: 4, day: 6, time_slot: '10-12', volunteer_name: '김철수', note: null, user_id: 'u2', created_at: '', volunteer_type: 'volunteer', time_sub: null, color: null },
    ]
    const state = getCellState(6, '10-12', 2026, 4, baseRules, baseSettings, noOverrides, assignments)
    expect(state.isFull).toBe(true)
    expect(state.assignments).toHaveLength(2)
  })

  it('respects date_override holiday', () => {
    const overrides: DateOverride[] = [
      { id: 'o1', date: '2026-04-06', is_open: false, is_holiday: true, label: '휴관일' }
    ]
    const state = getCellState(6, '10-12', 2026, 4, baseRules, baseSettings, overrides, noAssignments)
    expect(state.isHoliday).toBe(true)
  })
})
