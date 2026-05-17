import type { TimeSlot, Assignment, SlotSetting, ScheduleRule, DateOverride, CellState } from '../types'
import { DEFAULT_MAX_CAPACITY } from '../types'
import { isKoreanHoliday } from './koreanHolidays'

export function getCellState(
  day: number,
  timeSlot: TimeSlot,
  year: number,
  month: number,
  scheduleRules: ScheduleRule[],
  slotSettings: SlotSetting[],
  dateOverrides: DateOverride[],
  allAssignments: Assignment[]
): CellState {
  const date = new Date(year, month - 1, day)
  const dayOfWeek = date.getDay()
  const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`

  const override = dateOverrides.find(d => d.date === dateStr)
  const rule = scheduleRules.find(r => r.day_of_week === dayOfWeek && r.time_slot === timeSlot)

  // Holiday: explicit override, Sunday without open rule, or Korean public holiday (when no override exists)
  const isHoliday = override?.is_holiday === true
    || (dayOfWeek === 0 && rule?.is_open !== true)
    || (override === undefined && isKoreanHoliday(dateStr))

  // Breaktime: slot is closed by rule on a non-holiday day (e.g. lunch break)
  const isClosedByRule = rule ? !rule.is_open : true
  const isBreaktime = isClosedByRule && !isHoliday && override === undefined

  if (isHoliday) {
    return {
      isBreaktime: false,
      isClosed: true,
      isHoliday: true,
      isNightShift: false,
      isSaturdayShift: false,
      assignments: [],
      maxCapacity: 0,
      isFull: false,
    }
  }

  if (isBreaktime) {
    return {
      isBreaktime: true,
      isClosed: true,
      isHoliday: false,
      isNightShift: false,
      isSaturdayShift: false,
      assignments: [],
      maxCapacity: 0,
      isFull: false,
    }
  }

  const isClosed = override ? !override.is_open : isClosedByRule
  const isSaturdayShift = dayOfWeek === 6

  // Night shift: last slot of the day (heuristic: start hour >= 20)
  const startHour = parseInt(timeSlot.split('-')[0], 10)
  const isNightShift = startHour >= 20

  const dayAssignments = allAssignments.filter(
    a => a.year === year && a.month === month && a.day === day && a.time_slot === timeSlot
  )

  const setting = slotSettings.find(s => s.time_slot === timeSlot)
  const maxCapacity = setting?.max_capacity ?? DEFAULT_MAX_CAPACITY

  return {
    isBreaktime: false,
    isClosed,
    isHoliday: false,
    isNightShift,
    isSaturdayShift,
    assignments: dayAssignments,
    maxCapacity,
    isFull: dayAssignments.length >= maxCapacity,
  }
}
