import { useState } from 'react'
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

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']

export function MobileScheduleView({ year, month, assignments, slotSettings, scheduleRules, dateOverrides, highlightName, onCellClick }: Props) {
  const daysCount = new Date(year, month, 0).getDate()
  const days = Array.from({ length: daysCount }, (_, i) => i + 1)
  const [selectedDay, setSelectedDay] = useState(1)
  const dayLabel = DAY_LABELS[new Date(year, month - 1, selectedDay).getDay()]
  const isSun = dayLabel === '일'
  const isSat = dayLabel === '토'

  return (
    <div>
      <div className="flex overflow-x-auto gap-1 pb-2 mb-3">
        {days.map(d => {
          const dl = DAY_LABELS[new Date(year, month - 1, d).getDay()]
          const isSunDay = dl === '일'
          const isSatDay = dl === '토'
          return (
            <button
              key={d}
              onClick={() => setSelectedDay(d)}
              className={`flex-shrink-0 w-10 h-12 rounded text-xs font-medium border
                ${selectedDay === d ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-gray-300'}
                ${isSunDay && selectedDay !== d ? 'text-red-500' : ''}
                ${isSatDay && selectedDay !== d ? 'text-blue-600' : ''}`}
            >
              <div>{d}</div>
              <div>{dl}</div>
            </button>
          )
        })}
      </div>

      <div className="text-sm font-bold mb-2 text-gray-700">
        {month}월 {selectedDay}일 ({dayLabel})
        {(isSun || isSat) && (
          <span className={`ml-2 text-xs ${isSun ? 'text-red-500' : 'text-blue-500'}`}>
            {isSun ? '일요일' : '토요일'}
          </span>
        )}
      </div>
      <div className="space-y-1">
        {TIME_SLOTS.map(slot => {
          const cellState = getCellState(selectedDay, slot as TimeSlot, year, month, scheduleRules, slotSettings, dateOverrides, assignments)
          return (
            <div key={slot} className="flex items-stretch gap-2">
              <div className="w-16 text-xs font-medium text-gray-600 flex items-center justify-center bg-gray-100 rounded px-1">{slot}</div>
              <div className="flex-1">
                <TimeSlotCell
                  cellState={cellState}
                  highlightName={highlightName}
                  onClick={() => onCellClick({ year, month, day: selectedDay, timeSlot: slot as TimeSlot })}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
