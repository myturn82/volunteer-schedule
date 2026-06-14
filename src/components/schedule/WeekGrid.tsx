import type { Assignment, SlotSetting, ScheduleRule, DateOverride, ModalTarget, Profile, TenantRole, TimeSlot, TenantAccessRole } from '../../types'
import { getCellState } from '../../utils/cellState'
import { shortSlotLabel, slotStartLabel, formatTimeSub } from '../../utils/timeSlots'
import { LockIcon } from '../icons/LockIcons'

const DAY_LABELS = ['월', '화', '수', '목', '금', '토', '일']
const INDICATOR_BAR_COLOR = 'oklch(0.65 0.15 60)'

const STRIPE_STYLE = {
  background: 'repeating-linear-gradient(135deg, transparent 0 6px, rgba(20,23,28,0.03) 6px 12px)',
} as const
const HOLIDAY_STRIPE = {
  background: 'repeating-linear-gradient(135deg, transparent 0 8px, oklch(0.96 0.02 25 / 0.6) 8px 16px)',
} as const


function EmptyOrLockHint({ isLocked }: { isLocked: boolean }) {
  if (isLocked) {
    return <LockIcon size={11} className="text-[var(--color-text-muted)]" />
  }
  return (
    <span className="text-base leading-none text-[var(--color-border-strong)] group-hover:text-[var(--color-brand-primary)] transition-colors select-none">
      +
    </span>
  )
}

interface Props {
  weekDays: Date[]
  timeSlots: TimeSlot[]
  assignments: Assignment[]
  slotSettings: SlotSetting[]
  scheduleRules: ScheduleRule[]
  dateOverrides: DateOverride[]
  highlightName: string | null
  profile: Profile | null
  splitRoles?: TenantRole[]
  indicatorBarRoles?: TenantRole[]
  isSplitMode?: boolean
  slotLabels?: Record<string, string>
  selectedDay?: Date | null
  onDateHeaderClick?: (date: Date) => void
  onCellClick: (target: ModalTarget) => void
  memberRoleId?: string | null
  tenantRole?: TenantAccessRole | null
  teamLeaderUserIds?: Set<string>
  isPrivileged?: boolean
  displayAssignmentFilter?: (a: Assignment) => boolean
  withdrawnUserIds?: Set<string>
  highlightedSlots?: Set<string>
}

export function WeekGrid({
  weekDays, timeSlots, assignments, slotSettings, scheduleRules, dateOverrides,
  highlightName, splitRoles = [], indicatorBarRoles = [], isSplitMode = false, slotLabels = {},
  selectedDay, onDateHeaderClick, onCellClick,
  memberRoleId, teamLeaderUserIds, isPrivileged = false, displayAssignmentFilter, withdrawnUserIds, highlightedSlots,
}: Props) {
  const pad2 = (n: number) => String(n).padStart(2, '0')
  const today = new Date()
  const activeRoles = isSplitMode && splitRoles.length > 0 ? splitRoles : []
  const isAdmin = isPrivileged
  const indicatorBarRoleIds = new Set(indicatorBarRoles.map(r => r.id))

  function isSameDay(a: Date, b: Date) {
    return a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
  }

  const timeColW = 72
  const dayColMinW = activeRoles.length > 1 ? activeRoles.length * 52 : 64
  const minTotalW = timeColW + 7 * dayColMinW

  return (
    <div className="overflow-x-auto -mx-1 sm:mx-0 rounded-xl border border-[var(--color-border)]">
      <div style={{ minWidth: minTotalW }}>

        {/* ── Day header row ── */}
        <div
          className="grid sticky top-0 z-10 bg-[var(--color-surface-secondary)] border-b border-[var(--color-border)]"
          style={{ gridTemplateColumns: `${timeColW}px repeat(7, 1fr)` }}
        >
          {/* Corner */}
          <div className="px-2 py-2 text-[9px] font-medium text-[var(--color-text-muted)] uppercase tracking-wide border-r border-[var(--color-border)] flex items-center justify-center">
            시간
          </div>

          {weekDays.map((d, i) => {
            const isToday = isSameDay(d, today)
            const isSelected = selectedDay ? isSameDay(d, selectedDay) : false
            const dow = d.getDay()
            const isSat = dow === 6
            const isSun = dow === 0

            return (
              <button
                key={i}
                onClick={() => onDateHeaderClick?.(d)}
                className={`border-l border-[var(--color-border)] px-1 pt-2 pb-1 text-center transition-colors hover:bg-[var(--color-surface-hover)] ${
                  isSelected ? 'bg-[var(--color-brand-primary)]/8' : ''
                }`}
              >
                <div className={`text-[10px] font-semibold leading-none mb-0.5 text-center ${
                  isSun ? 'text-red-400' : isSat ? 'text-blue-400' : 'text-[var(--color-text-muted)]'
                }`}>
                  {DAY_LABELS[i]}
                </div>
                <div className={`text-base font-bold leading-none text-center ${
                  isToday ? 'text-[var(--color-brand-primary)]' :
                  isSun ? 'text-red-400' : isSat ? 'text-blue-400' : 'text-[var(--color-text-primary)]'
                }`}>
                  {d.getDate()}
                </div>

                {/* Role sub-headers */}
                {activeRoles.length > 0 && (
                  <div className="mt-1.5 grid" style={{ gridTemplateColumns: `repeat(${activeRoles.length}, 1fr)` }}>
                    {activeRoles.map((role, ri) => (
                      <div
                        key={role.id}
                        className={`text-[8px] font-medium text-[var(--color-text-muted)] truncate py-0.5 ${
                          ri > 0 ? 'pl-1 border-l border-dashed border-[var(--color-border-strong)]' : ''
                        }`}
                      >
                        {role.name}
                      </div>
                    ))}
                  </div>
                )}
              </button>
            )
          })}
        </div>

        {/* ── Time slot rows ── */}
        {timeSlots.map(slot => {
          const [slotStartNum] = slot.split('-').map(Number)
          const isMoon = slotStartNum >= 20
          return (
            <div
              key={slot}
              className={`grid border-t border-[var(--color-border)] ${isMoon ? 'bg-[oklch(0.99_0.005_280)]' : ''}`}
              style={{ gridTemplateColumns: `${timeColW}px repeat(7, 1fr)`, minHeight: 52 }}
            >
              {/* Time label */}
              <div className="px-1.5 py-1.5 flex flex-col justify-center items-center text-center border-r border-[var(--color-border)]">
                <span className="text-[9px] font-medium text-[var(--color-text-secondary)] leading-snug break-all">
                  {slotLabels[slot] ?? (
                    <>
                      <span className="hidden sm:inline">{shortSlotLabel(slot)}</span>
                      <span className="sm:hidden">{slotStartLabel(slot)}</span>
                    </>
                  )}
                </span>
              </div>

              {/* 7 day cells */}
              {weekDays.map((d, di) => {
                const y = d.getFullYear(), m = d.getMonth() + 1, day = d.getDate()
                const cs = getCellState(day, slot, y, m, scheduleRules, slotSettings, dateOverrides, assignments)
                const displayCs = displayAssignmentFilter
                  ? { ...cs, assignments: cs.assignments.filter(displayAssignmentFilter) }
                  : cs

                if (cs.isHoliday) {
                  return (
                    <div key={di}
                      className="border-l border-[var(--color-border)] flex items-center justify-center"
                      style={HOLIDAY_STRIPE}
                    >
                      <span className="text-[9px] font-medium" style={{ color: 'oklch(0.55 0.16 25)' }}>휴관</span>
                    </div>
                  )
                }

                if (cs.isBreaktime || cs.isClosed) {
                  return (
                    <div key={di}
                      className="border-l border-[var(--color-border)] flex items-center justify-center text-[9px] text-[var(--color-text-muted)]"
                      style={STRIPE_STYLE}
                    >
                      ✕
                    </div>
                  )
                }

                // ── Split mode: role sub-columns ──
                if (activeRoles.length > 0) {
                  const hasBar = displayCs.assignments.some(a => a.role_id && indicatorBarRoleIds.has(a.role_id))
                  const hlKey = `${y}-${pad2(m)}-${pad2(day)}|${slot}`
                  const isSlotHighlighted = !displayCs.assignments.length && (highlightedSlots?.has(hlKey) ?? false)
                  return (
                    <div
                      key={di}
                      className="relative border-l border-[var(--color-border)] grid"
                      style={{ gridTemplateColumns: `repeat(${activeRoles.length}, 1fr)` }}
                    >
                      {isSlotHighlighted && (
                        <span className="absolute inset-[2px] rounded pointer-events-none z-20" style={{ border: '2px dashed var(--color-brand-primary)' }} />
                      )}
                      {hasBar && (
                        <span className="absolute left-0 top-0 bottom-0 w-[3px] z-10 pointer-events-none" style={{ background: INDICATOR_BAR_COLOR }} />
                      )}
                      {activeRoles.map((role, ri) => {
                        const roleAssigns = displayCs.assignments.filter(
                          a => a.role_id === role.id && !(a.user_id && teamLeaderUserIds?.has(a.user_id))
                        )
                        const canClick = isAdmin || memberRoleId === role.id
                        const tint = isMoon
                          ? { bg: 'var(--tint-moon)', ink: 'var(--tint-moon-ink)' }
                          : { bg: 'var(--tint-sun)',  ink: 'var(--tint-sun-ink)' }

                        return (
                          <button
                            key={role.id}
                            disabled={!canClick}
                            onClick={() => {
                              if (!canClick) return
                              onCellClick({ year: y, month: m, day, timeSlot: slot, memberType: 'member', roleId: role.id })
                            }}
                            className={`flex flex-col items-center justify-center gap-0.5 p-1 transition-colors ${
                              ri > 0 ? 'border-l border-dashed border-[var(--color-border-strong)]' : ''
                            } ${canClick ? (roleAssigns.length > 0 ? 'group hover:brightness-95' : 'group hover:bg-[var(--color-surface-hover)]') : 'cursor-default'}`}
                            style={{ background: roleAssigns.length > 0 ? tint.bg : undefined }}
                          >
                            {roleAssigns.length > 0 ? (
                              roleAssigns.map(a => {
                                const _hq = highlightName?.toLowerCase() ?? ''
                                const isHighlighted = !!(highlightName && (
                                  a.member_name.toLowerCase().includes(_hq) ||
                                  (a.note && a.note.toLowerCase().includes(_hq)) ||
                                  (a.customer_name && a.customer_name.toLowerCase().includes(_hq)) ||
                                  (a.customer_phone && a.customer_phone.includes(_hq)) ||
                                  (a.extra_data && Object.values(a.extra_data).some(v => String(v ?? '').toLowerCase().includes(_hq)))
                                ))
                                const timeLbl = a.time_sub ? formatTimeSub(a.time_sub) : null
                                const isWithdrawn = !!(a.user_id && withdrawnUserIds?.has(a.user_id)) || a.account_deleted
                                return (
                                  <div
                                    key={a.id}
                                    className="w-full rounded-md px-1 py-0.5 text-[8px] sm:text-[10px] font-semibold text-center"
                                    style={isHighlighted
                                      ? { background: '#fef08a', color: '#92400e' }
                                      : isWithdrawn
                                        ? { background: 'oklch(0.97 0.02 25)', color: 'oklch(0.55 0.16 25)', opacity: 0.85 }
                                        : { background: tint.bg, color: tint.ink }}
                                  >
                                    <span className="flex items-center justify-center gap-0.5 w-full">
                                      <span className="truncate min-w-0" style={isWithdrawn ? { textDecoration: 'line-through' } : undefined}>{a.member_name}</span>
                                      {a.is_locked && <LockIcon size={8} className="shrink-0" />}
                                    </span>
                                    {isWithdrawn && <span className="block text-[6px] sm:text-[8px] font-normal">삭제됨</span>}
                                    {timeLbl && <span className="block text-[6px] sm:text-[8px] font-normal opacity-60">{timeLbl}</span>}
                                  </div>
                                )
                              })
                            ) : canClick ? (
                              <EmptyOrLockHint isLocked={cs.isLocked} />
                            ) : null}
                          </button>
                        )
                      })}
                    </div>
                  )
                }

                // ── Non-split mode: single cell ──
                const hasBar = displayCs.assignments.some(a => a.role_id && indicatorBarRoleIds.has(a.role_id))
                const visibleAssigns = displayCs.assignments.filter(
                  a => a.member_type !== 'admin_note' && !(a.user_id && teamLeaderUserIds?.has(a.user_id)) && !indicatorBarRoleIds.has(a.role_id ?? '')
                )
                const baseTint = isMoon
                  ? { bg: 'var(--tint-moon)', ink: 'var(--tint-moon-ink)' }
                  : { bg: 'var(--tint-sun)',  ink: 'var(--tint-sun-ink)' }
                const plusTint = { bg: 'var(--tint-plus)', ink: 'var(--tint-plus-ink)' }
                const isAllPlus = visibleAssigns.length > 0 && visibleAssigns.every(a => a.member_type === '50plus')
                const cellTint = isAllPlus ? plusTint : baseTint
                const hlKey = `${y}-${pad2(m)}-${pad2(day)}|${slot}`
                const isHighlighted = !visibleAssigns.length && (highlightedSlots?.has(hlKey) ?? false)


                return (
                  <button
                    key={di}
                    onClick={() => onCellClick({ year: y, month: m, day, timeSlot: slot, memberType: 'member' })}
                    className={`relative border-l border-[var(--color-border)] flex flex-col items-center justify-center gap-0.5 p-1 group transition-colors ${visibleAssigns.length > 0 ? 'hover:brightness-95' : 'hover:bg-[var(--color-surface-hover)]'}`}
                    style={{
                      background: visibleAssigns.length > 0 ? cellTint.bg : undefined,
                    }}
                  >
                    {isHighlighted && (
                      <span className="absolute inset-[2px] rounded pointer-events-none" style={{ border: '2px dashed var(--color-brand-primary)' }} />
                    )}
                    {hasBar && (
                      <span className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: INDICATOR_BAR_COLOR }} />
                    )}
                    {isHighlighted && !cs.isLocked && (
                      <span className="text-sm leading-none select-none">📌</span>
                    )}
                    {visibleAssigns.length > 0 ? (
                      visibleAssigns.map(a => {
                        const _hq = highlightName?.toLowerCase() ?? ''
                        const isHighlighted = !!(highlightName && (
                          a.member_name.toLowerCase().includes(_hq) ||
                          (a.note && a.note.toLowerCase().includes(_hq)) ||
                          (a.customer_name && a.customer_name.toLowerCase().includes(_hq)) ||
                          (a.customer_phone && a.customer_phone.includes(_hq)) ||
                          (a.extra_data && Object.values(a.extra_data).some(v => String(v ?? '').toLowerCase().includes(_hq)))
                        ))
                        const chipTint = a.member_type === '50plus' ? plusTint : baseTint
                        const timeLbl = a.time_sub ? formatTimeSub(a.time_sub) : null
                        const isWithdrawn = !!(a.user_id && withdrawnUserIds?.has(a.user_id)) || a.account_deleted
                        return (
                          <div
                            key={a.id}
                            className="w-full rounded-md px-1 py-0.5 text-[8px] sm:text-[10px] font-semibold text-center"
                            style={isHighlighted
                              ? { background: '#fef08a', color: '#92400e' }
                              : isWithdrawn
                                ? { background: 'oklch(0.97 0.02 25)', color: 'oklch(0.55 0.16 25)', opacity: 0.85 }
                                : { background: chipTint.bg, color: chipTint.ink }}
                          >
                            <span className="flex items-center justify-center gap-0.5 w-full">
                              <span className="truncate min-w-0" style={isWithdrawn ? { textDecoration: 'line-through' } : undefined}>{a.member_name}</span>
                              {a.is_locked && <LockIcon size={8} className="shrink-0" />}
                            </span>
                            {isWithdrawn && <span className="block text-[6px] sm:text-[8px] font-normal">삭제됨</span>}
                            {timeLbl && <span className="block text-[6px] sm:text-[8px] font-normal opacity-60">{timeLbl}</span>}
                          </div>
                        )
                      })
                    ) : (
                      <EmptyOrLockHint isLocked={cs.isLocked} />
                    )}
                  </button>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
