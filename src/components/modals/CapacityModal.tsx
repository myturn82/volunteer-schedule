import { useState } from 'react'
import { TIME_SLOTS } from '../../types'
import type { SlotSetting, TimeSlot } from '../../types'

interface Props {
  slotSettings: SlotSetting[]
  onClose: () => void
  onUpdate: (timeSlot: TimeSlot, maxCapacity: number) => Promise<string | null>
}

export function CapacityModal({ slotSettings, onClose, onUpdate }: Props) {
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleChange(timeSlot: TimeSlot, value: string) {
    const n = parseInt(value, 10)
    if (isNaN(n) || n < 0) return
    setLoading(timeSlot)
    const err = await onUpdate(timeSlot, n)
    setLoading(null)
    if (err) setError(err)
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold">슬롯별 최대 인원 설정</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>
        {error && <p className="text-red-500 text-xs mb-2">{error}</p>}
        <div className="space-y-2">
          {TIME_SLOTS.filter(s => s !== '12-13').map(slot => {
            const setting = slotSettings.find(s => s.time_slot === slot)
            return (
              <div key={slot} className="flex items-center justify-between">
                <span className="text-sm font-medium w-20">{slot}시</span>
                <input
                  type="number" min={0} max={10}
                  defaultValue={setting?.max_capacity ?? 2}
                  disabled={loading === slot}
                  onBlur={e => handleChange(slot as TimeSlot, e.target.value)}
                  className="w-20 border border-gray-300 rounded px-2 py-1 text-sm text-center"
                />
                <span className="text-xs text-gray-400">명</span>
              </div>
            )
          })}
        </div>
        <button onClick={onClose} className="mt-4 w-full border border-gray-300 rounded py-2 text-sm hover:bg-gray-50">
          닫기
        </button>
      </div>
    </div>
  )
}
