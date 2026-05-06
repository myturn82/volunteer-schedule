import { getCellState } from '../../utils/cellState'
import { TIME_SLOTS } from '../../types'
import { TimeSlotCell } from './TimeSlotCell'
import type { Assignment, SlotSetting, ScheduleRule, DateOverride, TimeSlot, ModalTarget } from '../../types'

interface Props {
  year: number
  month: number
  assignments: Assignment[]
  slotSettings: SlotSetting[]
  scheduleRules: ScheduleRule[]
  dateOverrides: DateOverride[]
  highlightName: string | null
  onCellClick: (target: ModalTarget) => void
}

function getDaysInMonth(year: number, month: number): number[] {
  const count = new Date(year, month, 0).getDate()
  return Array.from({ length: count }, (_, i) => i + 1)
}

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']

export function ScheduleGrid({ year, month, assignments, slotSettings, scheduleRules, dateOverrides, highlightName, onCellClick }: Props) {
  const days = getDaysInMonth(year, month)

  return (
    <div className="overflow-x-auto">
      <table className="border-collapse text-sm w-full min-w-max">
        <thead>
          <tr>
            <th className="border border-gray-300 bg-gray-100 px-2 py-1 text-xs sticky left-0 z-10">시간/일자</th>
            {days.map(day => {
              const label = DAY_LABELS[new Date(year, month - 1, day).getDay()]
              const isSat = label === '토'
              const isSun = label === '일'
              return (
                <th
                  key={day}
                  className={`border border-gray-300 px-1 py-1 text-xs font-medium min-w-[4.5rem]
                    ${isSun ? 'text-red-500 bg-red-50' : isSat ? 'text-blue-600 bg-blue-50' : 'bg-gray-50'}`}
                >
                  <span>{day}</span><br />{label}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {TIME_SLOTS.map(slot => (
            <tr key={slot}>
              <td className="border border-gray-300 bg-gray-100 px-2 py-1 text-xs font-medium text-center sticky left-0 z-10 whitespace-nowrap">
                {slot}
              </td>
              {days.map(day => {
                const cellState = getCellState(day, slot as TimeSlot, year, month, scheduleRules, slotSettings, dateOverrides, assignments)
                return (
                  <td key={day} className="border border-gray-200 p-0">
                    <TimeSlotCell
                      cellState={cellState}
                      highlightName={highlightName}
                      onClick={() => onCellClick({ year, month, day, timeSlot: slot as TimeSlot })}
                    />
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
