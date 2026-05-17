import type { Assignment, CellState } from '../../types'

interface Props {
  cellState: CellState
  timeSlot: string
  colType: 'vol' | 'plus' | 'role'
  onClick: () => void
  highlightName: string | null
  teamLeaderUserIds?: Set<string>
  roleId?: string | null
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

function NameList({ assignments, highlightName, small, teamLeaderUserIds }: {
  assignments: Assignment[]
  highlightName: string | null
  small?: boolean
  teamLeaderUserIds?: Set<string>
}) {
  const textSize = small ? 'text-[6px] sm:text-[9px]' : 'text-[8px] sm:text-[11px]'
  return (
    <div className="flex flex-col gap-0.5 items-center w-full">
      {assignments.map(a => {
        const isTeamLeader = teamLeaderUserIds?.has(a.user_id)
        if (isTeamLeader) return null
        const isHighlighted = !!(highlightName && a.volunteer_name.includes(highlightName))
        const displayText = a.note ? `${a.volunteer_name}(${a.note})` : a.volunteer_name
        return (
          <span
            key={a.id}
            className={`${textSize} break-all leading-tight rounded-sm px-0.5 w-full font-medium text-center block
              ${isHighlighted
                ? 'bg-schedule-highlight text-amber-900 font-bold'
                : 'text-[var(--color-text-primary)]'
              }`}
          >
            {displayText}
            {a.customer_name && (
              <span className="block text-[6px] sm:text-[8px] text-[var(--color-text-muted)] font-normal leading-tight">
                → {a.customer_name}{a.customer_phone ? ` · ${a.customer_phone}` : ''}
              </span>
            )}
          </span>
        )
      })}
    </div>
  )
}

export function TimeSlotCell({ cellState, timeSlot, colType, onClick, highlightName, teamLeaderUserIds, roleId }: Props) {
  const { isBreaktime, isClosed, isHoliday, isNightShift, isSaturdayShift, assignments, isFull } = cellState
  const PLUS_BG = '#FED7AA'
  const [slotStart, slotEnd] = timeSlot.split('-').map(Number)
  const cellMinH = slotEnd - slotStart === 1
    ? 'min-h-[1.25rem] sm:min-h-[1.75rem]'
    : 'min-h-[2rem] sm:min-h-[2.5rem]'

  if (isBreaktime) {
    if (colType === 'plus') return <div className={`h-full ${cellMinH} bg-schedule-breaktime`} />
    return (
      <div className={`h-full ${cellMinH} bg-schedule-breaktime flex items-center justify-center`}>
        <span className="sm:hidden text-[8px] text-[var(--color-text-muted)] font-medium">✕</span>
        <span className="hidden sm:inline text-[9px] text-[var(--color-text-muted)] font-medium">CLOSE</span>
      </div>
    )
  }

  if (isHoliday || isClosed) {
    if (colType === 'plus') return <div className={`h-full ${cellMinH} bg-schedule-close`} />
    return (
      <div className={`h-full ${cellMinH} bg-schedule-close flex items-center justify-center`}>
        <span className="sm:hidden text-[8px] text-[var(--color-text-muted)] font-medium">{isHoliday ? '휴관' : '✕'}</span>
        <span className="hidden sm:inline text-[9px] text-[var(--color-text-muted)] font-medium">{isHoliday ? '휴관' : 'CLOSE'}</span>
      </div>
    )
  }

  const slotHours = getSlotHours(timeSlot)

  // ── role column (split mode) ─────────────────────────────────────────────────
  if (colType === 'role') {
    const roleAssignments = assignments.filter(a => a.role_id === roleId)
    const shouldSplitRole = slotHours.length === 2 && roleAssignments.some(a => a.time_sub && !a.time_sub.includes('~'))

    if (shouldSplitRole) {
      return (
        <div className="flex flex-col divide-y divide-[var(--color-border-table)] h-full">
          {slotHours.map(hour => {
            const hourAssignments = roleAssignments.filter(a => assignmentCoversHour(a.time_sub, hour))
            return (
              <button key={hour} onClick={onClick}
                className="flex-1 min-h-[1rem] flex flex-col items-center justify-center px-0.5 transition-all duration-150 active:scale-[0.98] bg-[var(--color-surface)] hover:bg-blue-50/50 dark:hover:bg-blue-950/20">
                <NameList assignments={hourAssignments} highlightName={highlightName} teamLeaderUserIds={teamLeaderUserIds} />
              </button>
            )
          })}
        </div>
      )
    }

    return (
      <button onClick={onClick}
        className={`w-full ${cellMinH} flex flex-col items-center justify-center px-0.5 transition-all duration-150 active:scale-[0.98] bg-[var(--color-surface)] hover:bg-blue-50/50 dark:hover:bg-blue-950/20`}>
        <NameList assignments={roleAssignments} highlightName={highlightName} teamLeaderUserIds={teamLeaderUserIds} />
        {isFull && roleAssignments.length > 0 && (
          <span className="text-[7px] sm:text-[10px] text-red-500 font-semibold mt-0.5 bg-red-50 dark:bg-red-950/30 px-1 rounded-sm leading-tight">마감</span>
        )}
      </button>
    )
  }

  // ── legacy vol / plus columns ────────────────────────────────────────────────
  const volunteerAssignments = assignments.filter(a => !a.volunteer_type || a.volunteer_type === 'volunteer')
  const plusAssignments = assignments.filter(a => a.volunteer_type === '50plus')
  const saturdayAssignments = isSaturdayShift ? [...volunteerAssignments, ...plusAssignments] : volunteerAssignments
  const hasTeamLeaderInVol = !!(teamLeaderUserIds && volunteerAssignments.some(a => teamLeaderUserIds.has(a.user_id)))

  if (colType === 'vol') {
    const bgClass = hasTeamLeaderInVol
      ? 'bg-yellow-100 hover:bg-yellow-200/80 dark:bg-yellow-950/30 dark:hover:bg-yellow-900/40'
      : 'bg-[var(--color-surface)] hover:bg-blue-50/50 dark:hover:bg-blue-950/20'

    const shouldSplit = slotHours.length === 2 && saturdayAssignments.some(a => a.time_sub && !a.time_sub.includes('~'))

    if (shouldSplit) {
      return (
        <div className="flex flex-col divide-y divide-[var(--color-border-table)] h-full">
          {slotHours.map(hour => {
            const hourVol = saturdayAssignments.filter(a => assignmentCoversHour(a.time_sub, hour))
            const hourPlus = plusAssignments.filter(a => assignmentCoversHour(a.time_sub, hour))
            const hourHasLeader = !!(teamLeaderUserIds && hourVol.some(a => teamLeaderUserIds.has(a.user_id)))
            const hourBg = hourHasLeader
              ? 'bg-yellow-100 hover:bg-yellow-200/80 dark:bg-yellow-950/30 dark:hover:bg-yellow-900/40'
              : bgClass
            const hourFull = isFull && hourVol.length > 0
            return (
              <button key={hour} onClick={onClick}
                className={`flex-1 min-h-[1rem] flex flex-col items-center justify-center px-0.5 transition-all duration-150 active:scale-[0.98] ${hourBg}`}
                style={isSaturdayShift && hourPlus.length > 0 && !hourHasLeader ? { backgroundColor: PLUS_BG } : undefined}
              >

                <NameList assignments={hourVol} highlightName={highlightName} teamLeaderUserIds={teamLeaderUserIds} />
                {hourFull && (
                  <span className="text-[7px] sm:text-[10px] text-red-500 font-semibold bg-red-50 dark:bg-red-950/30 px-1 rounded-sm leading-tight">마감</span>
                )}
              </button>
            )
          })}
        </div>
      )
    }

    return (
      <button onClick={onClick}
        className={`w-full ${cellMinH} flex flex-col items-center justify-center px-0.5 transition-all duration-150 active:scale-[0.98] ${bgClass}`}
        style={isSaturdayShift && plusAssignments.length > 0 && !hasTeamLeaderInVol ? { backgroundColor: PLUS_BG } : undefined}
      >
        {shiftDot}
        <NameList assignments={saturdayAssignments} highlightName={highlightName} teamLeaderUserIds={teamLeaderUserIds} />
        {isFull && saturdayAssignments.length > 0 && (
          <span className="text-[7px] sm:text-[10px] text-red-500 font-semibold mt-0.5 bg-red-50 dark:bg-red-950/30 px-1 rounded-sm leading-tight">마감</span>
        )}
      </button>
    )
  }

  // colType === 'plus'
  const shouldSplitPlus = slotHours.length === 2 && plusAssignments.some(a => a.time_sub && !a.time_sub.includes('~'))

  if (shouldSplitPlus) {
    return (
      <div className="flex flex-col divide-y divide-[var(--color-border-table)] h-full">
        {slotHours.map(hour => {
          const hourPlus = plusAssignments.filter(a => assignmentCoversHour(a.time_sub, hour))
          const hasPlus = hourPlus.length > 0
          return (
            <button key={hour} onClick={onClick}
              className={`flex-1 min-h-[1rem] flex flex-col items-center justify-center px-0.5 transition-all duration-150 active:scale-[0.98] ${hasPlus ? 'hover:brightness-95' : 'bg-purple-50/30 dark:bg-purple-950/10 hover:bg-purple-50/60'}`}
              style={hasPlus ? { backgroundColor: PLUS_BG } : undefined}
            >
              <NameList assignments={hourPlus} highlightName={highlightName} small teamLeaderUserIds={teamLeaderUserIds} />
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <button onClick={onClick}
      className={`w-full ${cellMinH} flex flex-col items-center justify-center px-0.5 transition-all duration-150 active:scale-[0.98] ${plusAssignments.length > 0 ? 'hover:brightness-95' : 'bg-purple-50/30 dark:bg-purple-950/10 hover:bg-purple-50/60'}`}
      style={plusAssignments.length > 0 ? { backgroundColor: PLUS_BG } : undefined}
    >
      <NameList assignments={plusAssignments} highlightName={highlightName} small teamLeaderUserIds={teamLeaderUserIds} />
    </button>
  )
}
