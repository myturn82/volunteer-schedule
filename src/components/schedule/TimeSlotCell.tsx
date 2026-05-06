import type { CellState } from '../../types'

interface Props {
  cellState: CellState
  onClick: () => void
  highlightName: string | null
}

export function TimeSlotCell({ cellState, onClick, highlightName }: Props) {
  const { isBreaktime, isClosed, isHoliday, isNightShift, isSaturdayShift, assignments, isFull } = cellState

  if (isBreaktime) {
    return (
      <div className="min-h-[2.5rem] bg-gray-100 flex items-center justify-center text-xs text-gray-500 border border-gray-200">
        BREAKTIME
      </div>
    )
  }

  if (isHoliday || isClosed) {
    return (
      <div className="min-h-[2.5rem] bg-gray-200 flex items-center justify-center text-xs text-gray-500 border border-gray-200">
        {isHoliday ? '휴관' : 'CLOSE'}
      </div>
    )
  }

  const bgClass = isNightShift
    ? 'bg-pink-50 hover:bg-pink-100'
    : isSaturdayShift
    ? 'bg-yellow-50 hover:bg-yellow-100'
    : 'bg-white hover:bg-blue-50'

  return (
    <button
      onClick={onClick}
      className={`min-h-[2.5rem] w-full text-left px-1 py-0.5 border border-gray-200 ${bgClass} transition-colors`}
    >
      {isNightShift && <span className="text-pink-400 mr-0.5">★</span>}
      {isSaturdayShift && !isNightShift && <span className="text-yellow-400 mr-0.5">★</span>}
      <div className="flex flex-col gap-0.5">
        {assignments.map(a => (
          <span
            key={a.id}
            className={`text-xs truncate ${highlightName && a.volunteer_name.includes(highlightName) ? 'bg-yellow-200 font-bold rounded px-0.5' : ''}`}
          >
            {a.volunteer_name}{a.note ? `(${a.note})` : ''}
          </span>
        ))}
        {isFull && <span className="text-xs text-red-400">(정원 마감)</span>}
      </div>
    </button>
  )
}
