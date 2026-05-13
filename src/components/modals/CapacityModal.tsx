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
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--color-surface)] border border-[var(--color-border-strong)] rounded-2xl shadow-[var(--shadow-xl)] w-full max-w-sm animate-scale-in">
        <div className="flex justify-between items-center px-5 pt-5 pb-3 border-b border-[var(--color-border)]">
          <div>
            <h2 className="text-base font-bold text-[var(--color-text-primary)]">슬롯별 최대 인원</h2>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">시간대별 최대 봉사자 수를 설정합니다</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl border border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-secondary)] transition-all duration-200 text-lg leading-none"
          >
            ×
          </button>
        </div>

        <div className="px-5 py-4">
          {error && (
            <p className="text-red-500 text-xs bg-red-50 dark:bg-red-950/30 px-3 py-2 rounded-lg border border-red-200 dark:border-red-900/50 mb-3">
              {error}
            </p>
          )}
          <div className="space-y-2">
            {TIME_SLOTS.filter(s => s !== '12-13').map(slot => {
              const setting = slotSettings.find(s => s.time_slot === slot)
              return (
                <div
                  key={slot}
                  className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-[var(--color-surface-secondary)] border border-[var(--color-border)]"
                >
                  <span className="text-sm font-medium text-[var(--color-text-primary)] w-20">{slot}시</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      max={10}
                      defaultValue={setting?.max_capacity ?? 2}
                      disabled={loading === slot}
                      onBlur={e => handleChange(slot as TimeSlot, e.target.value)}
                      className="w-16 border border-[var(--color-border-strong)] rounded-lg px-2 py-1.5 text-sm text-center bg-[var(--color-surface)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500/60 transition-all duration-200"
                    />
                    <span className="text-xs text-[var(--color-text-muted)] w-4">명</span>
                  </div>
                </div>
              )
            })}
          </div>

          <button
            onClick={onClose}
            className="mt-4 w-full border border-[var(--color-border-strong)] text-[var(--color-text-secondary)] rounded-xl py-2.5 text-sm font-medium hover:bg-[var(--color-surface-hover)] transition-all duration-200"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}
