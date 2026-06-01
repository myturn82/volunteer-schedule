import type { Assignment, SlotSetting, ScheduleRule, DateOverride, ModalTarget, Profile, TenantRole, TimeSlot } from '../../types'
import { getCellState } from '../../utils/cellState'
import { parseSlotLabel } from '../../utils/timeSlots'

const DAY_KR = ['일', '월', '화', '수', '목', '금', '토']

const STRIPE_STYLE = {
  background: 'repeating-linear-gradient(135deg, transparent 0 6px, rgba(20,23,28,0.03) 6px 12px)',
} as const

const HOLIDAY_STRIPE_STYLE = {
  background: 'repeating-linear-gradient(135deg, transparent 0 8px, oklch(0.96 0.02 25 / 0.6) 8px 16px)',
} as const

interface Props {
  year: number
  month: number
  day: number
  timeSlots: TimeSlot[]
  assignments: Parameters<typeof getCellState>[7]
  slotSettings: SlotSetting[]
  scheduleRules: ScheduleRule[]
  dateOverrides: DateOverride[]
  profile: Profile | null
  splitRoles?: TenantRole[]
  isSplitMode?: boolean
  slotLabels?: Record<string, string>
  onCellClick: (target: ModalTarget) => void
  displayAssignmentFilter?: (a: Assignment) => boolean
}

export function DayView({
  year, month, day, timeSlots, assignments, slotSettings, scheduleRules, dateOverrides,
  profile: _profile, splitRoles = [], isSplitMode = false, slotLabels = {}, onCellClick, displayAssignmentFilter,
}: Props) {
  const dow = new Date(year, month - 1, day).getDay()

  return (
    <div className="space-y-2">
      <div className="text-sm font-semibold text-[var(--color-text-muted)] px-1 mb-3">
        {month}월 {day}일 ({DAY_KR[dow]}요일)
      </div>

      {timeSlots.every(slot => {
        const cs = getCellState(day, slot, year, month, scheduleRules, slotSettings, dateOverrides, assignments)
        const displayCs = displayAssignmentFilter
          ? { ...cs, assignments: cs.assignments.filter(displayAssignmentFilter) }
          : cs
        const vis = isSplitMode ? displayCs.assignments : displayCs.assignments.filter(a => a.volunteer_type !== 'admin_note')
        return cs.isBreaktime || cs.isClosed || cs.isHoliday || vis.length === 0
      }) && (
        <div className="text-sm text-[var(--color-text-muted)] text-center py-10">이날 등록된 스케줄이 없습니다.</div>
      )}

      {timeSlots.map(slot => {
        const cs = getCellState(day, slot, year, month, scheduleRules, slotSettings, dateOverrides, assignments)
        const displayCs = displayAssignmentFilter
          ? { ...cs, assignments: cs.assignments.filter(displayAssignmentFilter) }
          : cs
        const slotLabel = slotLabels[slot] ? `${slotLabels[slot]} (${parseSlotLabel(slot)})` : parseSlotLabel(slot)
        const visible = isSplitMode
          ? displayCs.assignments
          : displayCs.assignments.filter(a => a.volunteer_type !== 'admin_note')

        if (cs.isBreaktime || cs.isClosed) {
          return (
            <div key={slot} className="rounded-xl border border-[var(--color-border)] px-4 py-3" style={STRIPE_STYLE}>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-[var(--color-text-muted)]">{slotLabel}</span>
                <span className="text-[10px] text-[var(--color-text-muted)]">휴게</span>
              </div>
            </div>
          )
        }

        if (cs.isHoliday) {
          return (
            <div key={slot} className="rounded-xl border px-4 py-3" style={{ ...HOLIDAY_STRIPE_STYLE, borderColor: 'oklch(0.88 0.04 25)' }}>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-[var(--color-text-muted)]">{slotLabel}</span>
                <span className="text-[10px] font-medium" style={{ color: 'oklch(0.55 0.16 25)' }}>휴관</span>
              </div>
            </div>
          )
        }

        if (visible.length === 0) return null

        return (
          <button
            key={slot}
            onClick={() => onCellClick({ year, month, day, timeSlot: slot, volunteerType: 'volunteer' })}
            className="w-full text-left rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] hover:border-[var(--color-brand-primary)]/40 transition-all px-4 py-3 group"
          >
            {/* Slot header */}
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-[var(--color-text-secondary)]">{slotLabel}</span>
              <div className="flex items-center gap-1.5">
                {cs.isFull ? (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'oklch(0.97 0.02 25)', color: 'oklch(0.55 0.16 25)' }}>
                    마감 {visible.length}/{cs.maxCapacity}
                  </span>
                ) : visible.length > 0 ? (
                  <span className="text-[10px] text-[var(--color-text-muted)]">{visible.length}/{cs.maxCapacity}명</span>
                ) : null}
                <span className="text-[10px] text-[var(--color-brand-primary)] opacity-0 group-hover:opacity-100 transition-opacity">+ 추가</span>
              </div>
            </div>

            {/* Assignments */}
            {isSplitMode ? (
              <div className="space-y-1.5">
                {splitRoles.map(role => {
                  const roleAssigns = visible.filter(a => a.role_id === role.id)
                  return (
                    <div key={role.id}>
                      <div className="text-[10px] text-[var(--color-text-muted)] font-medium mb-0.5">{role.name}</div>
                      {roleAssigns.length > 0 ? roleAssigns.map(a => (
                        <div key={a.id} className="flex items-center gap-2 text-xs text-[var(--color-text-primary)] ml-2">
                          <span className="font-medium">{a.volunteer_name}</span>
                          {a.customer_phone && <span className="text-[var(--color-text-muted)]">· {a.customer_phone}</span>}
                          {a.note && <span className="text-[var(--color-text-muted)]">· {a.note}</span>}
                        </div>
                      )) : (
                        <div className="text-[10px] text-[var(--color-text-muted)] ml-2">(비어있음)</div>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : visible.length > 0 ? (
              <div className="flex flex-col gap-1">
                {visible.map(a => (
                  <div key={a.id} className="flex items-center gap-2 text-xs text-[var(--color-text-primary)]">
                    <span className="w-1 h-1 rounded-full bg-[var(--color-brand-primary)] shrink-0 mt-px" />
                    <span className="font-medium">{a.volunteer_name}</span>
                    {a.note && <span className="text-[var(--color-text-muted)]">· {a.note}</span>}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-[var(--color-text-muted)]">(비어있음)</div>
            )}
          </button>
        )
      })}
    </div>
  )
}
