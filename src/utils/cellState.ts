import type { TimeSlot, Assignment, SlotSetting, ScheduleRule, DateOverride, CellState } from '../types'
import { DEFAULT_MAX_CAPACITY } from '../types'

// 휴관/규칙에 관계없이 항상 운영하는 요일+시간 조합
function isForceOpen(dayOfWeek: number, timeSlot: TimeSlot): boolean {
  if (dayOfWeek === 6 && timeSlot === '12-13') return true   // 토요일 12-13
  if (dayOfWeek === 3 && timeSlot === '13-14') return true   // 수요일 13-14
  if (dayOfWeek === 3 && timeSlot === '14-16') return true   // 수요일 14-16
  return false
}

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

  const isBreaktime = timeSlot === '12-13' && dayOfWeek !== 6  // 토요일은 12-13 정상 운영

  // 강제 운영 슬롯은 휴관일 여부와 관계없이 먼저 처리
  if (!isBreaktime && isForceOpen(dayOfWeek, timeSlot)) {
    const dayAssignments = allAssignments.filter(
      a => a.year === year && a.month === month && a.day === day && a.time_slot === timeSlot
    )
    const setting = slotSettings.find(s => s.time_slot === timeSlot)
    const maxCapacity = setting?.max_capacity ?? DEFAULT_MAX_CAPACITY
    return {
      isBreaktime: false,
      isClosed: false,
      isHoliday: false,
      isNightShift: timeSlot === '20-22',
      isSaturdayShift: dayOfWeek === 6,
      assignments: dayAssignments,
      maxCapacity,
      isFull: dayAssignments.length >= maxCapacity,
    }
  }

  const override = dateOverrides.find(d => d.date === dateStr)
  const isHoliday = override?.is_holiday === true || dayOfWeek === 0

  if (isHoliday || isBreaktime) {
    return { isBreaktime, isClosed: true, isHoliday, isNightShift: false, isSaturdayShift: false, assignments: [], maxCapacity: 0, isFull: false }
  }

  const rule = scheduleRules.find(r => r.day_of_week === dayOfWeek && r.time_slot === timeSlot)
  const isClosed = rule ? !rule.is_open : true

  const isNightShift = timeSlot === '20-22'
  const isSaturdayShift = dayOfWeek === 6

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
