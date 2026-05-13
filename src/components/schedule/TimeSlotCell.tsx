import type { Assignment, CellState } from '../../types'

interface Props {
  cellState: CellState
  timeSlot: string
  onClickVolunteer: () => void
  onClickPlus: () => void
  highlightName: string | null
  teamLeaderUserIds?: Set<string>
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
  const noteSize = small ? 'text-[5px] sm:text-[8px]' : 'text-[6px] sm:text-[9px]'
  return (
    <div className="flex flex-col gap-0.5 items-center w-full">
      {assignments.map(a => {
        const isTeamLeader = teamLeaderUserIds?.has(a.user_id)
        const isHighlighted = !!(highlightName && a.volunteer_name.includes(highlightName))
        return (
          <div key={a.id} className="w-full">
            <span
              className={`${textSize} break-all leading-tight rounded-sm px-0.5 w-full font-medium text-center block
                ${isHighlighted
                  ? 'bg-schedule-highlight text-amber-900 font-bold'
                  : isTeamLeader
                  ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 font-bold'
                  : 'text-[var(--color-text-primary)]'
                }`}
            >
              {a.volunteer_name}
            </span>
            {a.note && (
              <span className={`${noteSize} leading-tight block text-center w-full px-0.5 text-[var(--color-text-muted)] ${isTeamLeader ? 'bg-amber-50 dark:bg-amber-900/20' : ''}`}>
                {a.note}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

export function TimeSlotCell({ cellState, timeSlot, onClickVolunteer, onClickPlus, highlightName, teamLeaderUserIds }: Props) {
  const { isBreaktime, isClosed, isHoliday, isNightShift, isSaturdayShift, assignments, isFull } = cellState

  if (isBreaktime) {
    return (
      <div className="h-full min-h-[2rem] sm:min-h-[2.5rem] bg-schedule-breaktime flex items-center justify-center">
        <span className="sm:hidden text-[8px] text-[var(--color-text-muted)] font-medium">BR</span>
        <span className="hidden sm:inline text-[9px] text-[var(--color-text-muted)] font-medium tracking-widest uppercase">Break</span>
      </div>
    )
  }

  if (isHoliday || isClosed) {
    return (
      <div className="h-full min-h-[2rem] sm:min-h-[2.5rem] bg-schedule-close flex items-center justify-center">
        <span className="sm:hidden text-[8px] text-[var(--color-text-muted)] font-medium">{isHoliday ? '휴관' : '✕'}</span>
        <span className="hidden sm:inline text-[9px] text-[var(--color-text-muted)] font-medium">{isHoliday ? '휴관' : 'CLOSE'}</span>
      </div>
    )
  }

  const volunteerAssignments = assignments.filter(a => !a.volunteer_type || a.volunteer_type === 'volunteer')
  const plusAssignments = assignments.filter(a => a.volunteer_type === '50plus')
  const plusCellColor = plusAssignments.find(a => a.color)?.color

  const hasTeamLeaderInVol = !!(teamLeaderUserIds && volunteerAssignments.some(a => teamLeaderUserIds.has(a.user_id)))

  const bgClass = hasTeamLeaderInVol
    ? 'bg-amber-50 hover:bg-amber-100/80 dark:bg-amber-950/20 dark:hover:bg-amber-900/30'
    : isNightShift
    ? 'bg-schedule-night hover:bg-schedule-night-hover'
    : isSaturdayShift
    ? 'bg-schedule-saturday hover:bg-schedule-saturday-hover'
    : 'bg-[var(--color-surface)] hover:bg-blue-50/50 dark:hover:bg-blue-950/20'

  const shiftDot = isNightShift
    ? <span className="text-pink-400 text-[8px] sm:text-[9px] font-bold">★</span>
    : null

  const slotHours = getSlotHours(timeSlot)

  // Show split view for 2-hour slots when any assignment has a single-hour time_sub
  const shouldSplit = slotHours.length === 2 && (
    volunteerAssignments.some(a => a.time_sub && !a.time_sub.includes('~')) ||
    plusAssignments.some(a => a.time_sub && !a.time_sub.includes('~'))
  )

  const plusClass = `flex-none flex flex-col items-center justify-center px-0.5 transition-all duration-150 active:scale-[0.98] ${!plusCellColor ? 'bg-purple-50/40 dark:bg-purple-950/10 hover:bg-purple-50 dark:hover:bg-purple-950/30' : 'hover:brightness-95'}`
  const dividerV = 'divide-x divide-[var(--color-border-table)]'
  const dividerH = 'divide-y divide-[var(--color-border-table)]'

  if (shouldSplit) {
    return (
      <div className={`flex ${dividerV} h-full`}>
        {/* Volunteer column — split by hour */}
        <div className={`flex-1 flex flex-col ${dividerH}`}>
          {slotHours.map(hour => {
            const hourVol = volunteerAssignments.filter(a => assignmentCoversHour(a.time_sub, hour))
            const hourHasTeamLeader = !!(teamLeaderUserIds && hourVol.some(a => teamLeaderUserIds.has(a.user_id)))
            const hourBgClass = hourHasTeamLeader
              ? 'bg-amber-50 hover:bg-amber-100/80 dark:bg-amber-950/20 dark:hover:bg-amber-900/30'
              : bgClass
            const hourFull = isFull && hourVol.length > 0
            return (
              <button
                key={hour}
                onClick={onClickVolunteer}
                className={`flex-1 min-h-[1rem] flex flex-col items-center justify-center px-0.5 transition-all duration-150 active:scale-[0.98] ${hourBgClass}`}
              >
                {shiftDot}
                <NameList assignments={hourVol} highlightName={highlightName} teamLeaderUserIds={teamLeaderUserIds} />
                {hourFull && (
                  <span className="text-[7px] sm:text-[10px] text-red-500 font-semibold bg-red-50 dark:bg-red-950/30 px-1 rounded-sm leading-tight">
                    마감
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* 50plus column — split by hour (토요일 제외) */}
        {!isSaturdayShift && (
          <div className={`w-[46%] flex flex-col ${dividerH}`}>
            {slotHours.map(hour => {
              const hourPlus = plusAssignments.filter(a => assignmentCoversHour(a.time_sub, hour))
              const hourColor = hourPlus.find(a => a.color)?.color
              return (
                <button
                  key={hour}
                  onClick={onClickPlus}
                  className={`flex-1 min-h-[1rem] flex flex-col items-center justify-center px-0.5 transition-all duration-150 active:scale-[0.98] ${!hourColor ? 'bg-purple-50/40 dark:bg-purple-950/10 hover:bg-purple-50 dark:hover:bg-purple-950/30' : 'hover:brightness-95'}`}
                  style={hourColor ? { backgroundColor: hourColor } : undefined}
                >
                  <NameList assignments={hourPlus} highlightName={highlightName} small teamLeaderUserIds={teamLeaderUserIds} />
                </button>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // Default (non-split) view
  return (
    <div className={`flex ${dividerV} h-full`}>
      <button
        onClick={onClickVolunteer}
        className={`flex-1 min-h-[2rem] sm:min-h-[2.5rem] flex flex-col items-center justify-center px-0.5 transition-all duration-150 active:scale-[0.98] ${bgClass}`}
      >
        {shiftDot}
        <NameList assignments={volunteerAssignments} highlightName={highlightName} teamLeaderUserIds={teamLeaderUserIds} />
        {isFull && volunteerAssignments.length > 0 && (
          <span className="text-[7px] sm:text-[10px] text-red-500 font-semibold mt-0.5 bg-red-50 dark:bg-red-950/30 px-1 rounded-sm leading-tight">
            마감
          </span>
        )}
      </button>
      {!isSaturdayShift && (
        <button
          onClick={onClickPlus}
          className={`w-[46%] min-h-[2rem] sm:min-h-[2.5rem] ${plusClass}`}
          style={plusCellColor ? { backgroundColor: plusCellColor } : undefined}
        >
          <NameList assignments={plusAssignments} highlightName={highlightName} small teamLeaderUserIds={teamLeaderUserIds} />
        </button>
      )}
    </div>
  )
}
