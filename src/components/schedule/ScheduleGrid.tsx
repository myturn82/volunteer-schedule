import { Fragment } from 'react'
import { getCellState } from '../../utils/cellState'
import { TIME_SLOTS } from '../../types'
import { TimeSlotCell } from './TimeSlotCell'
import type { Assignment, SlotSetting, ScheduleRule, DateOverride, TimeSlot, ModalTarget, Profile } from '../../types'

interface Props {
  year: number
  month: number
  assignments: Assignment[]
  slotSettings: SlotSetting[]
  scheduleRules: ScheduleRule[]
  dateOverrides: DateOverride[]
  highlightName: string | null
  profile?: Profile | null
  teamLeaderUserIds?: Set<string>
  onCellClick: (target: ModalTarget) => void
  onHolidayCellClick?: (day: number, startHour: number, endHour: number) => void
}

const DOW_ORDER = [1, 2, 3, 4, 5, 6, 0]
const DOW_LABELS = ['월', '화', '수', '목', '금', '토', '일']

function getCalendarWeeks(year: number, month: number): (number | null)[][] {
  const count = new Date(year, month, 0).getDate()
  const weeks: (number | null)[][] = []
  let currentWeek: (number | null)[] = new Array(7).fill(null)

  for (let day = 1; day <= count; day++) {
    const dow = new Date(year, month - 1, day).getDay()
    const idx = (dow + 6) % 7
    currentWeek[idx] = day
    if (idx === 6) {
      weeks.push([...currentWeek])
      currentWeek = new Array(7).fill(null)
    }
  }
  if (currentWeek.some(d => d !== null)) weeks.push(currentWeek)
  return weeks
}

function parseTimeSub(ts: string): [number, number] {
  if (ts.includes('~')) { const [s, e] = ts.split('~').map(Number); return [s, e + 1] }
  return [Number(ts), Number(ts) + 1]
}

function computeSlotGroups(
  notes: Assignment[],
  coveredSlots: TimeSlot[]
): { count: number; note: Assignment | null; startHour: number; endHour: number }[] {
  const groups: { count: number; note: Assignment | null; startHour: number; endHour: number }[] = []
  for (const slot of coveredSlots) {
    const [ss, se] = slot.split('-').map(Number)
    const note = notes.find(n => {
      if (!n.time_sub) return false
      const [ns, ne] = parseTimeSub(n.time_sub)
      return ns < se && ne > ss
    }) ?? null
    const last = groups[groups.length - 1]
    if (last && last.note?.id === note?.id) { last.count++; last.endHour = se }
    else groups.push({ count: 1, note, startHour: ss, endHour: se })
  }
  return groups
}

type CellMerge = {
  skip: boolean
  rowspan: number
  isHoliday: boolean
  isBlocked: boolean  // true = CLOSE/holiday merge, false = same-person merge
  label: string | null
}

function getSlotAssignmentKey(day: number, slot: TimeSlot, assignments: Assignment[]): string {
  const slotA = assignments.filter(a =>
    a.day === day && a.time_slot === slot && a.volunteer_type !== 'admin_note'
  )
  if (slotA.length === 0) return ''
  return slotA.map(a => `${a.volunteer_type}:${a.user_id}:${a.time_sub ?? ''}`).sort().join('|')
}

function buildMergeMap(
  week: (number | null)[],
  year: number,
  month: number,
  scheduleRules: ScheduleRule[],
  slotSettings: SlotSetting[],
  dateOverrides: DateOverride[],
  assignments: Assignment[]
): Map<string, CellMerge> {
  const map = new Map<string, CellMerge>()

  week.forEach((day, dowIdx) => {
    if (!day) return

    const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const overrideLabel = dateOverrides.find(d => d.date === dateKey)?.label ?? null

    let i = 0
    while (i < TIME_SLOTS.length) {
      const slot = TIME_SLOTS[i] as TimeSlot
      const s = getCellState(day, slot, year, month, scheduleRules, slotSettings, dateOverrides, assignments)

      if ((s.isClosed || s.isHoliday) && !s.isBreaktime) {
        let j = i + 1
        while (j < TIME_SLOTS.length) {
          const ns = getCellState(day, TIME_SLOTS[j] as TimeSlot, year, month, scheduleRules, slotSettings, dateOverrides, assignments)
          if (ns.isClosed || ns.isHoliday) j++
          else break
        }
        const span = j - i
        map.set(`${dowIdx}-${i}`, { skip: false, rowspan: span, isHoliday: s.isHoliday, isBlocked: true, label: overrideLabel })
        for (let k = i + 1; k < j; k++) {
          map.set(`${dowIdx}-${k}`, { skip: true, rowspan: 0, isHoliday: false, isBlocked: false, label: null })
        }
        i = j
      } else {
        // 연속 동일 근무자 머지
        const assignKey = getSlotAssignmentKey(day, slot, assignments)
        let span = 1
        if (assignKey) {
          let j = i + 1
          while (j < TIME_SLOTS.length) {
            const ns = getCellState(day, TIME_SLOTS[j] as TimeSlot, year, month, scheduleRules, slotSettings, dateOverrides, assignments)
            if (ns.isClosed || ns.isHoliday) break
            if (getSlotAssignmentKey(day, TIME_SLOTS[j] as TimeSlot, assignments) === assignKey) j++
            else break
          }
          span = j - i
        }
        map.set(`${dowIdx}-${i}`, { skip: false, rowspan: span, isHoliday: false, isBlocked: false, label: null })
        for (let k = i + 1; k < i + span; k++) {
          map.set(`${dowIdx}-${k}`, { skip: true, rowspan: 0, isHoliday: false, isBlocked: false, label: null })
        }
        i += span
      }
    }
  })

  return map
}

export function ScheduleGrid({ year, month, assignments, slotSettings, scheduleRules, dateOverrides, highlightName, profile, teamLeaderUserIds, onCellClick, onHolidayCellClick }: Props) {
  const isAdmin = profile?.role === 'admin'
  const weeks = getCalendarWeeks(year, month)

  const thBase = 'border border-[var(--color-border-table)] px-0.5 sm:px-2 py-1 text-[9px] sm:text-xs font-semibold text-center'
  const thTime = `${thBase} bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)] sticky left-0 z-10 w-9 sm:w-auto whitespace-nowrap`

  return (
    <div className="sm:overflow-x-auto">
      <table className="border-collapse text-sm w-full table-fixed sm:table-auto">
        <thead>
          <tr>
            <th className={thTime}>
              <span className="hidden sm:inline">시간/일자</span>
              <span className="sm:hidden">시간</span>
            </th>
            {DOW_ORDER.map((dow, i) => (
              <th
                key={dow}
                className={`${thBase} sm:min-w-[5rem]
                  ${dow === 0
                    ? 'text-red-500 bg-red-50/70 dark:bg-red-950/40'
                    : dow === 6
                    ? 'text-blue-500 bg-blue-50/70 dark:bg-blue-950/40'
                    : 'bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]'}`}
              >
                {DOW_LABELS[i]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week, weekIdx) => {
            const mergeMap = buildMergeMap(week, year, month, scheduleRules, slotSettings, dateOverrides, assignments)

            return (
              <Fragment key={weekIdx}>
                {/* Week date header */}
                <tr>
                  <td className="border-t-2 border-[var(--color-border-strong)] border-x border-b border-[var(--color-border-table)] bg-[var(--color-surface-secondary)] text-[var(--color-text-muted)] px-0.5 sm:px-2 py-1 text-[9px] sm:text-xs font-bold text-center sticky left-0 z-10 w-9 sm:w-auto">
                    {weekIdx + 1}주
                  </td>
                  {week.map((day, dowIdx) => {
                    const dow = DOW_ORDER[dowIdx]
                    return (
                      <td
                        key={dowIdx}
                        className={`border-t-2 border-[var(--color-border-strong)] border-x border-b border-[var(--color-border-table)] text-center text-[9px] sm:text-xs font-bold py-1
                          ${!day
                            ? 'bg-[var(--color-surface-secondary)] text-[var(--color-text-muted)]'
                            : dow === 0
                            ? 'text-red-500 bg-red-50/50 dark:bg-red-950/30'
                            : dow === 6
                            ? 'text-blue-500 bg-blue-50/50 dark:bg-blue-950/30'
                            : 'bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]'}`}
                      >
                        {day ?? ''}
                      </td>
                    )
                  })}
                </tr>

                {/* Time slot rows */}
                {TIME_SLOTS.map((slot, slotIdx) => (
                  <tr key={slot}>
                    <td className="border border-[var(--color-border-table)] bg-[var(--color-surface-secondary)] text-[var(--color-text-muted)] px-0.5 sm:px-2 py-1 text-[9px] sm:text-xs font-medium text-center sticky left-0 z-10 w-9 sm:w-auto">
                      <span className="sm:hidden">{slot.split('-')[0]}</span>
                      <span className="hidden sm:inline whitespace-nowrap">{slot}</span>
                    </td>
                    {week.map((day, dowIdx) => {
                      if (!day) {
                        return (
                          <td
                            key={dowIdx}
                            className="border border-[var(--color-border-table)] bg-[var(--color-surface-secondary)]"
                          />
                        )
                      }

                      const merge = mergeMap.get(`${dowIdx}-${slotIdx}`)
                      if (!merge || merge.skip) return null

                      // CLOSE / 휴관 머지 셀 — admin_note 기반 색상 분할
                      if (merge.isBlocked) {
                        const dayNotes = assignments.filter(
                          a => a.day === day && a.volunteer_type === 'admin_note'
                        )
                        const coveredSlots = TIME_SLOTS.slice(slotIdx, slotIdx + merge.rowspan) as TimeSlot[]
                        const slotGroups = computeSlotGroups(dayNotes, coveredSlots)
                        return (
                          <td
                            key={dowIdx}
                            rowSpan={merge.rowspan}
                            className="border border-[var(--color-border-table)] p-0 bg-schedule-close"
                            style={{ height: '1px' }}
                          >
                            <div className="flex flex-col h-full w-full">
                              {slotGroups.map((group, gi) => (
                                <div
                                  key={gi}
                                  style={{
                                    flex: group.count,
                                    minHeight: `${group.count * 2}rem`,
                                    backgroundColor: group.note?.volunteer_name || (group.note ? 'rgba(255,255,255,0.55)' : undefined),
                                  }}
                                  onClick={isAdmin && onHolidayCellClick
                                    ? (e) => { e.stopPropagation(); onHolidayCellClick(day, group.startHour, group.endHour) }
                                    : undefined}
                                  className={`flex flex-col items-center justify-center px-0.5 py-0.5 text-center
                                    ${isAdmin && onHolidayCellClick ? 'cursor-pointer hover:brightness-95 transition-all duration-150' : ''}`}
                                >
                                  {!group.note ? (
                                    <>
                                      <span className="sm:hidden text-[9px] text-[var(--color-text-muted)] font-medium">
                                        {merge.isHoliday ? '휴관' : '✕'}
                                      </span>
                                      <span className="hidden sm:block text-[10px] text-[var(--color-text-muted)] font-medium">
                                        {merge.isHoliday ? '휴관' : 'CLOSE'}
                                      </span>
                                      {gi === 0 && merge.label && (
                                        <span className="text-[8px] sm:text-[10px] text-[var(--color-text-muted)] leading-tight break-words text-center w-full">{merge.label}</span>
                                      )}
                                      {isAdmin && onHolidayCellClick && (
                                        <span className="hidden sm:block text-[9px] text-[var(--color-text-muted)] mt-0.5">+ 비고</span>
                                      )}
                                    </>
                                  ) : (
                                    <>
                                      <span className="hidden sm:block text-[10px] font-semibold text-[var(--color-text-secondary)] leading-tight">
                                        {group.note.time_sub ? (() => { const [s, e] = parseTimeSub(group.note.time_sub!); return `${s}~${e}시` })() : ''}
                                      </span>
                                      <span className="hidden sm:block text-[10px] text-[var(--color-text-secondary)] leading-tight break-all">{group.note.note}</span>
                                      <span className="sm:hidden w-2 h-2 rounded-full bg-[var(--color-text-muted)]/40 block" />
                                    </>
                                  )}
                                </div>
                              ))}
                            </div>
                          </td>
                        )
                      }

                      // 일반 셀 — 동일인 연속이면 rowspan 적용
                      const cellState = getCellState(day, slot as TimeSlot, year, month, scheduleRules, slotSettings, dateOverrides, assignments)
                      return (
                        <td
                          key={dowIdx}
                          rowSpan={merge.rowspan > 1 ? merge.rowspan : undefined}
                          className="border border-[var(--color-border-table)] p-0"
                          style={{ height: '1px' }}
                        >
                          <TimeSlotCell
                            cellState={cellState}
                            timeSlot={slot}
                            highlightName={highlightName}
                            teamLeaderUserIds={teamLeaderUserIds}
                            onClickVolunteer={() => onCellClick({ year, month, day, timeSlot: slot as TimeSlot, volunteerType: 'volunteer' })}
                            onClickPlus={() => onCellClick({ year, month, day, timeSlot: slot as TimeSlot, volunteerType: '50plus' })}
                          />
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
