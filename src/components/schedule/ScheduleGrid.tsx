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

// ── Merge map types ──────────────────────────────────────────────────────────

type BlockEntry = { skip: boolean; rowspan: number; isHoliday: boolean; label: string | null }
type ColEntry   = { skip: boolean; rowspan: number }

// ── Block merge (holiday / closed sequences) ─────────────────────────────────

function buildBlockMap(
  week: (number | null)[],
  year: number, month: number,
  scheduleRules: ScheduleRule[], slotSettings: SlotSetting[],
  dateOverrides: DateOverride[], assignments: Assignment[]
): Map<string, BlockEntry> {
  const map = new Map<string, BlockEntry>()

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
        map.set(`${dowIdx}-${i}`, { skip: false, rowspan: span, isHoliday: s.isHoliday, label: overrideLabel })
        for (let k = i + 1; k < j; k++) {
          map.set(`${dowIdx}-${k}`, { skip: true, rowspan: 0, isHoliday: false, label: null })
        }
        i = j
      } else {
        i++
      }
    }
  })
  return map
}

// ── Column merge (volunteer or 50plus, independently) ────────────────────────

function getVolKey(day: number, slot: TimeSlot, assignments: Assignment[]): string {
  const slotA = assignments.filter(a =>
    a.day === day && a.time_slot === slot &&
    (!a.volunteer_type || a.volunteer_type === 'volunteer')
  )
  if (slotA.length === 0) return ''
  return slotA.map(a => `${a.user_id}:${a.volunteer_name}:${a.note ?? ''}`).sort().join('|')
}

function getPlusKey(day: number, slot: TimeSlot, assignments: Assignment[]): string {
  const slotA = assignments.filter(a =>
    a.day === day && a.time_slot === slot && a.volunteer_type === '50plus'
  )
  if (slotA.length === 0) return ''
  return slotA.map(a => `${a.user_id}:${a.volunteer_name}:${a.note ?? ''}`).sort().join('|')
}

function buildColMap(
  week: (number | null)[],
  year: number, month: number,
  scheduleRules: ScheduleRule[], slotSettings: SlotSetting[],
  dateOverrides: DateOverride[], assignments: Assignment[],
  keyFn: (day: number, slot: TimeSlot, assignments: Assignment[]) => string
): Map<string, ColEntry> {
  const map = new Map<string, ColEntry>()

  week.forEach((day, dowIdx) => {
    if (!day) return

    let i = 0
    while (i < TIME_SLOTS.length) {
      const slot = TIME_SLOTS[i] as TimeSlot
      const s = getCellState(day, slot, year, month, scheduleRules, slotSettings, dateOverrides, assignments)

      if ((s.isClosed || s.isHoliday) && !s.isBreaktime) {
        // Skip blocked slots — blockMap handles them
        let j = i + 1
        while (j < TIME_SLOTS.length) {
          const ns = getCellState(day, TIME_SLOTS[j] as TimeSlot, year, month, scheduleRules, slotSettings, dateOverrides, assignments)
          if (ns.isClosed || ns.isHoliday) j++
          else break
        }
        i = j
        continue
      }

      if (s.isBreaktime) {
        map.set(`${dowIdx}-${i}`, { skip: false, rowspan: 1 })
        i++
        continue
      }

      // Each slot rendered independently — no vertical merge
      map.set(`${dowIdx}-${i}`, { skip: false, rowspan: 1 })
      i++
    }
  })
  return map
}

// ── Component ────────────────────────────────────────────────────────────────

export function ScheduleGrid({
  year, month, assignments, slotSettings, scheduleRules, dateOverrides,
  highlightName, profile, teamLeaderUserIds, onCellClick, onHolidayCellClick,
}: Props) {
  const isAdmin = profile?.role === 'admin' || profile?.role === 'team_leader'
  const weeks = getCalendarWeeks(year, month)

  const thBase = 'border border-[var(--color-border-table)] px-0.5 sm:px-2 py-1 text-[9px] sm:text-xs font-semibold text-center'
  const thTime = `${thBase} bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)] sticky left-0 z-10 w-9 sm:w-16 whitespace-nowrap`

  return (
    <div className="sm:overflow-x-auto">
      <table className="border-collapse text-sm w-full table-fixed">
        <thead>
          <tr>
            <th className={thTime}>
              <span className="hidden sm:inline">시간/일자</span>
              <span className="sm:hidden">시간</span>
            </th>
            {DOW_ORDER.map((dow, i) => (
              <th
                key={dow}
                colSpan={dow === 6 ? 1 : 2}
                className={`${thBase}
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
            const blockMap = buildBlockMap(week, year, month, scheduleRules, slotSettings, dateOverrides, assignments)
            const volMap   = buildColMap(week, year, month, scheduleRules, slotSettings, dateOverrides, assignments, getVolKey)
            const plusMap  = buildColMap(week, year, month, scheduleRules, slotSettings, dateOverrides, assignments, getPlusKey)

            return (
              <Fragment key={weekIdx}>
                {/* Week date header */}
                <tr>
                  <td className="border-t-2 border-[var(--color-border-strong)] border-x border-b border-[var(--color-border-table)] bg-[var(--color-surface-secondary)] text-[var(--color-text-muted)] px-0.5 sm:px-2 py-1 text-[9px] sm:text-xs font-bold text-center sticky left-0 z-10 w-9 sm:w-auto">
                    {weekIdx + 1}주
                  </td>
                  {week.map((day, dowIdx) => {
                    const dow = DOW_ORDER[dowIdx]
                    const isSat = dow === 6
                    return (
                      <td
                        key={dowIdx}
                        colSpan={isSat ? 1 : 2}
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
                      const dow = DOW_ORDER[dowIdx]
                      const isSat = dow === 6

                      if (!day) {
                        return (
                          <Fragment key={dowIdx}>
                            <td className="border border-[var(--color-border-table)] bg-[var(--color-surface-secondary)]" />
                            {!isSat && <td className="border border-[var(--color-border-table)] bg-[var(--color-surface-secondary)]" />}
                          </Fragment>
                        )
                      }

                      const blockMerge = blockMap.get(`${dowIdx}-${slotIdx}`)

                      // Blocked (holiday / closed) — spans both columns
                      if (blockMerge) {
                        if (blockMerge.skip) return null
                        const dayNotes = assignments.filter(a => a.day === day && a.volunteer_type === 'admin_note')
                        const coveredSlots = TIME_SLOTS.slice(slotIdx, slotIdx + blockMerge.rowspan) as TimeSlot[]
                        const slotGroups = computeSlotGroups(dayNotes, coveredSlots)
                        return (
                          <td
                            key={dowIdx}
                            colSpan={isSat ? 1 : 2}
                            rowSpan={blockMerge.rowspan}
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
                                        {blockMerge.isHoliday ? '휴관' : '✕'}
                                      </span>
                                      <span className="hidden sm:block text-[10px] text-[var(--color-text-muted)] font-medium">
                                        {blockMerge.isHoliday ? '휴관' : 'CLOSE'}
                                      </span>
                                      {gi === 0 && blockMerge.label && (
                                        <span className="text-[8px] sm:text-[10px] text-[var(--color-text-muted)] leading-tight break-words text-center w-full">{blockMerge.label}</span>
                                      )}
                                      {isAdmin && onHolidayCellClick && (
                                        <span className="hidden sm:block text-[9px] text-[var(--color-text-muted)] mt-0.5">+ 비고</span>
                                      )}
                                    </>
                                  ) : (
                                    <>
                                      <span className="text-[8px] sm:text-[10px] font-semibold text-[var(--color-text-secondary)] leading-tight">
                                        {group.note.time_sub ? (() => { const [s, e] = parseTimeSub(group.note.time_sub!); return `${s}~${e}시` })() : ''}
                                      </span>
                                      <span className="text-[8px] sm:text-[10px] text-[var(--color-text-secondary)] leading-tight break-all text-center">{group.note.note}</span>
                                    </>
                                  )}
                                </div>
                              ))}
                            </div>
                          </td>
                        )
                      }

                      // Regular open cell — vol and plus merge independently
                      const volMerge  = volMap.get(`${dowIdx}-${slotIdx}`)  ?? { skip: false, rowspan: 1 }
                      const plusMerge = plusMap.get(`${dowIdx}-${slotIdx}`) ?? { skip: false, rowspan: 1 }
                      const cellState = getCellState(day, slot as TimeSlot, year, month, scheduleRules, slotSettings, dateOverrides, assignments)

                      return (
                        <Fragment key={dowIdx}>
                          {!volMerge.skip && (
                            <td
                              rowSpan={volMerge.rowspan > 1 ? volMerge.rowspan : undefined}
                              className="border border-[var(--color-border-table)] p-0"
                              style={{ height: '1px' }}
                            >
                              <TimeSlotCell
                                cellState={cellState}
                                timeSlot={slot}
                                colType="vol"
                                onClick={() => onCellClick({ year, month, day, timeSlot: slot as TimeSlot, volunteerType: 'volunteer' })}
                                highlightName={highlightName}
                                teamLeaderUserIds={teamLeaderUserIds}
                              />
                            </td>
                          )}
                          {!isSat && !plusMerge.skip && (
                            <td
                              rowSpan={plusMerge.rowspan > 1 ? plusMerge.rowspan : undefined}
                              className="border border-[var(--color-border-table)] p-0"
                              style={{ height: '1px' }}
                            >
                              <TimeSlotCell
                                cellState={cellState}
                                timeSlot={slot}
                                colType="plus"
                                onClick={() => onCellClick({ year, month, day, timeSlot: slot as TimeSlot, volunteerType: '50plus' })}
                                highlightName={highlightName}
                                teamLeaderUserIds={teamLeaderUserIds}
                              />
                            </td>
                          )}
                        </Fragment>
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
