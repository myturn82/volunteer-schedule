import type { Assignment, CellState, TenantRole } from '../../types'
import { formatTimeSub } from '../../utils/timeSlots'
import { LockIcon } from '../icons/LockIcons'

const INDICATOR_BAR_COLOR = 'oklch(0.65 0.15 60)'

interface Props {
  cellState: CellState
  timeSlot: string
  colType: 'vol' | 'plus' | 'role'
  onClick: () => void
  highlightName: string | null
  teamLeaderUserIds?: Set<string>
  roleId?: string | null
  indicatorBarRoles?: TenantRole[]
  canInteract?: boolean
  onIndicatorBarClick?: () => void
  withdrawnUserIds?: Set<string>
  highlighted?: boolean
}

function getSlotHours(timeSlot: string): number[] {
  const [start, end] = timeSlot.split('-').map(Number)
  if (end - start !== 2) return []
  return [start, start + 1]
}

function assignmentCoversHour(timeSub: string | null, hour: number): boolean {
  if (!timeSub) return true
  if (timeSub.includes('~')) {
    const [s, e] = timeSub.split('~').map(Number)
    return hour >= s && hour <= e
  }
  return Number(timeSub) === hour
}

// Determine tint based on member_type and time slot
function resolveTint(colType: 'vol' | 'plus' | 'role', slotStart: number): { bg: string; ink: string } {
  if (colType === 'plus') return { bg: 'var(--tint-plus)', ink: 'var(--tint-plus-ink)' }
  if (slotStart >= 20)    return { bg: 'var(--tint-moon)', ink: 'var(--tint-moon-ink)' }
  return { bg: 'var(--tint-sun)', ink: 'var(--tint-sun-ink)' }
}

// Striped closed-cell pattern matching design
const STRIPE_STYLE = {
  background: 'repeating-linear-gradient(135deg, transparent 0 6px, rgba(20,23,28,0.03) 6px 12px)',
} as const
const HOLIDAY_STRIPE_STYLE = {
  background: 'repeating-linear-gradient(135deg, transparent 0 8px, oklch(0.96 0.02 25 / 0.6) 8px 16px)',
} as const

function NameChips({ assignments, highlightName, tintBg, tintInk, teamLeaderUserIds, small, showTimeSub, withdrawnUserIds }: {
  assignments: Assignment[]
  highlightName: string | null
  tintBg: string
  tintInk: string
  teamLeaderUserIds?: Set<string>
  small?: boolean
  showTimeSub?: boolean
  withdrawnUserIds?: Set<string>
}) {
  const visible = assignments.filter(a => !(a.user_id && teamLeaderUserIds?.has(a.user_id ?? '')))
  if (!visible.length) return null
  const textSize = small ? 'text-[6px] sm:text-[9px]' : 'text-[8px] sm:text-[11px]'
  const subSize = small ? 'text-[5px]' : 'text-[6px] sm:text-[8px]'
  return (
    <div className="flex flex-col gap-0.5 w-full px-0.5">
      {visible.map(a => {
        const _hq = highlightName?.toLowerCase() ?? ''
        const isHighlighted = !!(highlightName && (
          a.member_name.toLowerCase().includes(_hq) ||
          (a.note && a.note.toLowerCase().includes(_hq)) ||
          (a.customer_name && a.customer_name.toLowerCase().includes(_hq)) ||
          (a.customer_phone && a.customer_phone.includes(_hq)) ||
          (a.extra_data && Object.values(a.extra_data).some(v => String(v ?? '').toLowerCase().includes(_hq)))
        ))
        const isWithdrawn = !!(a.user_id && withdrawnUserIds?.has(a.user_id)) || a.account_deleted
        const displayText = a.note ? `${a.member_name}(${a.note})` : a.member_name
        const timeLabel = showTimeSub && a.time_sub ? formatTimeSub(a.time_sub) : null
        return (
          <div
            key={a.id}
            className={`rounded-[6px] px-1.5 py-0.5 leading-tight ${textSize} font-semibold w-full truncate text-center`}
            style={isHighlighted
              ? { background: '#fef08a', color: '#92400e' }
              : isWithdrawn
                ? { background: 'oklch(0.97 0.02 25)', color: 'oklch(0.55 0.16 25)', opacity: 0.85 }
                : { background: tintBg, color: tintInk }}
          >
            <span style={isWithdrawn ? { textDecoration: 'line-through' } : undefined}>{displayText}</span>
            {a.is_locked && <span title="고정됨" className="inline-flex items-center"><LockIcon size={9} className="ml-0.5" /></span>}
            {isWithdrawn && <span className={`block ${subSize} font-normal`}>삭제됨</span>}
            {timeLabel && (
              <span className={`block ${subSize} font-normal opacity-60`}>{timeLabel}</span>
            )}
            {a.customer_name && (
              <span className={`block ${subSize} font-normal opacity-70 truncate`}>
                {a.customer_name}{a.customer_phone ? ` · ${a.customer_phone}` : ''}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

function EmptyHint() {
  return (
    <span className="text-[var(--color-border-strong)] group-hover:text-[var(--color-brand-primary)] text-lg leading-none transition-colors duration-150 select-none">
      +
    </span>
  )
}

function EmptyOrLockHint({ isLocked }: { isLocked: boolean }) {
  if (isLocked) {
    return <LockIcon size={11} className="text-[var(--color-text-muted)]" />
  }
  return <EmptyHint />
}

export function TimeSlotCell({ cellState, timeSlot, colType, onClick, highlightName, teamLeaderUserIds, roleId, indicatorBarRoles, canInteract = true, onIndicatorBarClick, withdrawnUserIds, highlighted = false }: Props) {
  const { isBreaktime, isClosed, isHoliday, isSaturdayShift, isLocked, assignments, isFull } = cellState
  const [slotStart, slotEnd] = timeSlot.split('-').map(Number)
  const cellMinH = slotEnd - slotStart === 1
    ? 'min-h-[1.25rem] sm:min-h-[1.75rem]'
    : 'min-h-[2rem] sm:min-h-[2.5rem]'

  const tint = resolveTint(isSaturdayShift ? 'vol' : colType, slotStart)
  const satTint = { bg: 'var(--tint-sat)', ink: 'var(--tint-sat-ink)' }
  const effectiveTint = isSaturdayShift ? satTint : tint

  // ── CLOSE states ─────────────────────────────────────────────────────────────
  if (isBreaktime) {
    if (colType === 'plus') return <div className={`h-full ${cellMinH}`} style={STRIPE_STYLE} />
    return (
      <div className={`h-full ${cellMinH} flex items-center justify-center`} style={STRIPE_STYLE}>
        <span className="sm:hidden text-[8px] text-[var(--color-text-muted)] font-medium">✕</span>
        <span className="hidden sm:inline text-[9px] text-[var(--color-text-muted)] font-medium tracking-wide">CLOSE</span>
      </div>
    )
  }

  if (isHoliday) {
    if (colType === 'plus') return <div className={`h-full ${cellMinH}`} style={HOLIDAY_STRIPE_STYLE} />
    return (
      <div className={`h-full ${cellMinH} flex items-center justify-center`} style={HOLIDAY_STRIPE_STYLE}>
        <span className="text-[9px] font-medium" style={{ color: 'oklch(0.55 0.16 25)' }}>휴관</span>
      </div>
    )
  }

  if (isClosed) {
    if (colType === 'plus') return <div className={`h-full ${cellMinH}`} style={STRIPE_STYLE} />
    return (
      <div className={`h-full ${cellMinH} flex items-center justify-center`} style={STRIPE_STYLE}>
        <span className="sm:hidden text-[8px] text-[var(--color-text-muted)] font-medium">✕</span>
        <span className="hidden sm:inline text-[9px] text-[var(--color-text-muted)] font-medium tracking-wide">CLOSE</span>
      </div>
    )
  }

  const slotHours = getSlotHours(timeSlot)

  // indicator_bar 역할 배정 감지 (colType 무관하게 공통 계산)
  const indicatorBarUserIds = new Set(
    (indicatorBarRoles ?? []).flatMap(role =>
      assignments.filter(a => a.role_id === role.id).map(a => a.user_id)
    )
  )
  const hasIndicatorBar = indicatorBarUserIds.size > 0

  // ── role column (split mode) ─────────────────────────────────────────────────
  if (colType === 'role') {
    const roleAssignments = assignments.filter(a => a.role_id === roleId)
    const hasAssignments = roleAssignments.length > 0
    const shouldSplitRole = slotHours.length === 2 && roleAssignments.some(a => a.time_sub && !a.time_sub.includes('~'))

    if (shouldSplitRole) {
      const fullSlotRole = roleAssignments.filter(a => !a.time_sub || a.time_sub.includes('~'))
      const fullSlotHasBar = fullSlotRole.some(a => indicatorBarUserIds.has(a.user_id ?? ''))
      return (
        <div className="flex flex-col h-full">
          {fullSlotRole.length > 0 && (
            <button onClick={onClick}
              className="relative flex flex-col items-center justify-center px-0.5 py-0.5 border-b border-[var(--color-border-table)] group"
              style={{ background: tint.bg }}
            >
              {onIndicatorBarClick ? (
                <div role="button" tabIndex={0} onClick={e => { e.stopPropagation(); onIndicatorBarClick() }} onKeyDown={e => e.key === 'Enter' && (e.stopPropagation(), onIndicatorBarClick())}
                  className={`absolute left-0 top-0 bottom-0 z-10 flex items-center justify-center cursor-pointer transition-all duration-150
                    ${fullSlotHasBar ? 'w-5 hover:brightness-90 active:brightness-75' : 'w-[3px] opacity-0 group-hover:opacity-30 group-hover:w-3'}`}
                  style={{ background: INDICATOR_BAR_COLOR }} />
              ) : fullSlotHasBar ? (
                <span className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: INDICATOR_BAR_COLOR }} />
              ) : null}
              <NameChips assignments={fullSlotRole} highlightName={highlightName} tintBg={tint.bg} tintInk={tint.ink} teamLeaderUserIds={teamLeaderUserIds} showTimeSub withdrawnUserIds={withdrawnUserIds} />
            </button>
          )}
          <div className="flex flex-col divide-y divide-[var(--color-border-table)] flex-1">
            {slotHours.map(hour => {
              const hourA = roleAssignments.filter(a => a.time_sub && !a.time_sub.includes('~') && assignmentCoversHour(a.time_sub, hour))
              const hourHasBar = assignments.filter(a => assignmentCoversHour(a.time_sub, hour)).some(a => indicatorBarUserIds.has(a.user_id ?? ''))
              return (
                <button key={hour} onClick={onClick}
                  className={`relative flex-1 min-h-[1rem] flex flex-col items-center justify-center transition-all duration-150 active:scale-[0.98] group`}
                  style={{ background: hourA.length ? tint.bg : 'var(--color-surface)' }}
                >
                  {onIndicatorBarClick ? (
                    <div role="button" tabIndex={0} onClick={e => { e.stopPropagation(); onIndicatorBarClick() }} onKeyDown={e => e.key === 'Enter' && (e.stopPropagation(), onIndicatorBarClick())}
                      className={`absolute left-0 top-0 bottom-0 z-10 flex items-center justify-center cursor-pointer transition-all duration-150
                        ${hourHasBar ? 'w-5 hover:brightness-90 active:brightness-75' : 'w-[3px] opacity-0 group-hover:opacity-30 group-hover:w-3'}`}
                      style={{ background: INDICATOR_BAR_COLOR }} />
                  ) : hourHasBar ? (
                    <span className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: INDICATOR_BAR_COLOR }} />
                  ) : null}
                  {hourA.length
                    ? <NameChips assignments={hourA} highlightName={highlightName} tintBg={tint.bg} tintInk={tint.ink} teamLeaderUserIds={teamLeaderUserIds} showTimeSub withdrawnUserIds={withdrawnUserIds} />
                    : canInteract && <EmptyOrLockHint isLocked={isLocked} />
                  }
                </button>
              )
            })}
          </div>
        </div>
      )
    }

    return (
      <button onClick={onClick}
        className={`relative w-full h-full ${cellMinH} flex flex-col items-center justify-center transition-all duration-150 active:scale-[0.98] group`}
        style={{ background: hasAssignments ? tint.bg : 'var(--color-surface)' }}
      >
        {highlighted && !hasAssignments && (
          <span className="absolute inset-[2px] rounded pointer-events-none" style={{ border: '2px dashed var(--color-brand-primary)' }} />
        )}
        {onIndicatorBarClick ? (
          <div role="button" tabIndex={0} onClick={e => { e.stopPropagation(); onIndicatorBarClick() }} onKeyDown={e => e.key === 'Enter' && (e.stopPropagation(), onIndicatorBarClick())}
            className={`absolute left-0 top-0 bottom-0 z-10 flex items-center justify-center cursor-pointer transition-all duration-150
              ${hasIndicatorBar ? 'w-5 hover:brightness-90 active:brightness-75' : 'w-[3px] opacity-0 group-hover:opacity-30 group-hover:w-3'}`}
            style={{ background: INDICATOR_BAR_COLOR }} />
        ) : hasIndicatorBar ? (
          <span className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: INDICATOR_BAR_COLOR }} />
        ) : null}
        {hasAssignments
          ? <>
              <NameChips assignments={roleAssignments} highlightName={highlightName} tintBg={tint.bg} tintInk={tint.ink} teamLeaderUserIds={teamLeaderUserIds} withdrawnUserIds={withdrawnUserIds} />
              {isFull && <span className="text-[7px] sm:text-[9px] font-semibold mt-0.5 px-1.5 py-0.5 rounded-full" style={{ background: 'oklch(0.97 0.02 25)', color: 'oklch(0.55 0.16 25)' }}>마감</span>}
            </>
          : highlighted && !isLocked
            ? <span className="text-sm leading-none select-none">📌</span>
            : canInteract && <EmptyOrLockHint isLocked={isLocked} />
        }
      </button>
    )
  }

  // ── legacy vol / plus columns ────────────────────────────────────────────────
  const volunteerAssignments = assignments.filter(a => !a.member_type || a.member_type === 'member')
  const plusAssignments = assignments.filter(a => a.member_type === '50plus')
  const saturdayAssignments = isSaturdayShift ? [...volunteerAssignments, ...plusAssignments] : volunteerAssignments
  const hasTeamLeaderInVol = !!(teamLeaderUserIds && volunteerAssignments.some(a => teamLeaderUserIds.has(a.user_id ?? '')))

  const teamLeaderTint = { bg: 'oklch(0.95 0.07 85)', ink: 'oklch(0.42 0.12 80)' }

  const indicatorTint = { bg: 'oklch(0.97 0.04 60)', ink: 'oklch(0.45 0.12 60)' }

  if (colType === 'vol') {
    const activeTint = hasTeamLeaderInVol ? teamLeaderTint : effectiveTint
    const visibleAssignments = saturdayAssignments.filter(a => !teamLeaderUserIds?.has(a.user_id ?? '') && !indicatorBarUserIds.has(a.user_id ?? ''))
    const hasAssign = visibleAssignments.length > 0
    const shouldSplit = slotHours.length === 2 && saturdayAssignments.some(a => a.time_sub && !a.time_sub.includes('~'))

    if (shouldSplit) {
      const fullSlotVol = saturdayAssignments.filter(a => !a.time_sub || a.time_sub.includes('~'))
      const fullSlotHasLeader = !!(teamLeaderUserIds && fullSlotVol.some(a => teamLeaderUserIds.has(a.user_id ?? '')))
      const fullSlotHasBar = fullSlotVol.some(a => indicatorBarUserIds.has(a.user_id ?? ''))
      const fullSlotVisible = fullSlotVol.filter(a => !teamLeaderUserIds?.has(a.user_id ?? '') && !indicatorBarUserIds.has(a.user_id ?? ''))
      const fullSlotTint = fullSlotHasLeader ? teamLeaderTint : effectiveTint
      return (
        <div className="flex flex-col h-full">
          {fullSlotVisible.length > 0 && (
            <button onClick={onClick}
              className="relative flex flex-col items-center justify-center px-0.5 py-0.5 border-b border-[var(--color-border-table)] group"
              style={{ background: fullSlotTint.bg }}
            >
              {onIndicatorBarClick ? (
                <div role="button" tabIndex={0} onClick={e => { e.stopPropagation(); onIndicatorBarClick() }} onKeyDown={e => e.key === 'Enter' && (e.stopPropagation(), onIndicatorBarClick())}
                  className={`absolute left-0 top-0 bottom-0 z-10 flex items-center justify-center cursor-pointer transition-all duration-150
                    ${fullSlotHasBar ? 'w-5 hover:brightness-90 active:brightness-75' : 'w-[3px] opacity-0 group-hover:opacity-30 group-hover:w-3'}`}
                  style={{ background: INDICATOR_BAR_COLOR }} />
              ) : fullSlotHasBar ? (
                <span className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: INDICATOR_BAR_COLOR }} />
              ) : null}
              <NameChips assignments={fullSlotVisible} highlightName={highlightName} tintBg={fullSlotTint.bg} tintInk={fullSlotTint.ink} showTimeSub withdrawnUserIds={withdrawnUserIds} />
            </button>
          )}
          <div className="flex flex-col divide-y divide-[var(--color-border-table)] flex-1">
            {slotHours.map(hour => {
              const hourVol = saturdayAssignments.filter(a => a.time_sub && !a.time_sub.includes('~') && assignmentCoversHour(a.time_sub, hour))
              const hourHasLeader = !!(teamLeaderUserIds && hourVol.some(a => teamLeaderUserIds.has(a.user_id ?? '')))
              const hourHasBar = hourVol.some(a => indicatorBarUserIds.has(a.user_id ?? ''))
              const hourVisible = hourVol.filter(a => !teamLeaderUserIds?.has(a.user_id ?? '') && !indicatorBarUserIds.has(a.user_id ?? ''))
              const hourTint = hourHasLeader ? teamLeaderTint : hourHasBar && !hourVisible.length ? indicatorTint : effectiveTint
              return (
                <button key={hour} onClick={onClick}
                  className={`relative flex-1 min-h-[1rem] flex flex-col items-center justify-center transition-all duration-150 active:scale-[0.98] group`}
                  style={{ background: (hourVisible.length || hourHasBar) ? hourTint.bg : 'var(--color-surface)' }}
                >
                  {onIndicatorBarClick ? (
                    <div role="button" tabIndex={0} onClick={e => { e.stopPropagation(); onIndicatorBarClick() }} onKeyDown={e => e.key === 'Enter' && (e.stopPropagation(), onIndicatorBarClick())}
                      className={`absolute left-0 top-0 bottom-0 z-10 flex items-center justify-center cursor-pointer transition-all duration-150
                        ${hourHasBar ? 'w-5 hover:brightness-90 active:brightness-75' : 'w-[3px] opacity-0 group-hover:opacity-30 group-hover:w-3'}`}
                      style={{ background: INDICATOR_BAR_COLOR }} />
                  ) : hourHasBar ? (
                    <span className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: INDICATOR_BAR_COLOR }} />
                  ) : null}
                  {hourVisible.length
                    ? <NameChips assignments={hourVisible} highlightName={highlightName} tintBg={hourTint.bg} tintInk={hourTint.ink} teamLeaderUserIds={teamLeaderUserIds} showTimeSub withdrawnUserIds={withdrawnUserIds} />
                    : canInteract && <EmptyOrLockHint isLocked={isLocked} />
                  }
                </button>
              )
            })}
          </div>
        </div>
      )
    }

    const cellTint = hasTeamLeaderInVol ? teamLeaderTint : hasIndicatorBar && !hasAssign ? indicatorTint : activeTint
    return (
      <button onClick={onClick}
        className={`relative w-full h-full ${cellMinH} flex flex-col items-center justify-center transition-all duration-150 active:scale-[0.98] group`}
        style={{
          background: hasAssign || hasIndicatorBar ? cellTint.bg : 'var(--color-surface)',
        }}
      >
        {highlighted && !hasAssign && (
          <span className="absolute inset-[2px] rounded pointer-events-none" style={{ border: '2px dashed var(--color-brand-primary)' }} />
        )}
        {onIndicatorBarClick ? (
          <div role="button" tabIndex={0} onClick={e => { e.stopPropagation(); onIndicatorBarClick() }} onKeyDown={e => e.key === 'Enter' && (e.stopPropagation(), onIndicatorBarClick())}
            className={`absolute left-0 top-0 bottom-0 z-10 flex items-center justify-center cursor-pointer transition-all duration-150
              ${hasIndicatorBar ? 'w-5 hover:brightness-90 active:brightness-75' : 'w-[3px] opacity-0 group-hover:opacity-30 group-hover:w-3'}`}
            style={{ background: INDICATOR_BAR_COLOR }} />
        ) : hasIndicatorBar ? (
          <span className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: INDICATOR_BAR_COLOR }} />
        ) : null}
        {hasAssign
          ? <>
              <NameChips assignments={visibleAssignments} highlightName={highlightName} tintBg={cellTint.bg} tintInk={cellTint.ink} teamLeaderUserIds={teamLeaderUserIds} withdrawnUserIds={withdrawnUserIds} />
              {isFull && <span className="text-[7px] sm:text-[9px] font-semibold mt-0.5 px-1.5 py-0.5 rounded-full" style={{ background: 'oklch(0.97 0.02 25)', color: 'oklch(0.55 0.16 25)' }}>마감</span>}
            </>
          : highlighted && !isLocked
            ? <span className="text-sm leading-none select-none">📌</span>
            : canInteract && <EmptyOrLockHint isLocked={isLocked} />
        }
      </button>
    )
  }

  // colType === 'plus'
  const plusTint = { bg: 'var(--tint-plus)', ink: 'var(--tint-plus-ink)' }
  const hasPlusAssign = plusAssignments.length > 0
  const shouldSplitPlus = slotHours.length === 2 && plusAssignments.some(a => a.time_sub && !a.time_sub.includes('~'))

  if (shouldSplitPlus) {
    return (
      <div className="flex flex-col divide-y divide-[var(--color-border-table)] h-full">
        {slotHours.map(hour => {
          const hourPlus = plusAssignments.filter(a => assignmentCoversHour(a.time_sub, hour))
          return (
            <button key={hour} onClick={onClick}
              className={`flex-1 min-h-[1rem] flex flex-col items-center justify-center transition-all duration-150 active:scale-[0.98] group`}
              style={{ background: hourPlus.length ? plusTint.bg : 'var(--color-surface)' }}
            >
              {hourPlus.length
                ? <NameChips assignments={hourPlus} highlightName={highlightName} tintBg={plusTint.bg} tintInk={plusTint.ink} teamLeaderUserIds={teamLeaderUserIds} small withdrawnUserIds={withdrawnUserIds} />
                : canInteract && <EmptyOrLockHint isLocked={isLocked} />
              }
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <button onClick={onClick}
      className={`w-full h-full ${cellMinH} flex flex-col items-center justify-center transition-all duration-150 active:scale-[0.98] group`}
      style={{ background: hasPlusAssign ? plusTint.bg : 'var(--color-surface)' }}
    >
      {hasPlusAssign
        ? <NameChips assignments={plusAssignments} highlightName={highlightName} tintBg={plusTint.bg} tintInk={plusTint.ink} teamLeaderUserIds={teamLeaderUserIds} small withdrawnUserIds={withdrawnUserIds} />
        : canInteract && <EmptyOrLockHint isLocked={isLocked} />
      }
    </button>
  )
}
