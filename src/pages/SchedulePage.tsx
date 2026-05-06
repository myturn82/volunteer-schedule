import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useSchedule } from '../hooks/useSchedule'
import { getCellState } from '../utils/cellState'
import { ScheduleHeader } from '../components/schedule/ScheduleHeader'
import { ScheduleGrid } from '../components/schedule/ScheduleGrid'
import { MobileScheduleView } from '../components/schedule/MobileScheduleView'
import { Legend } from '../components/schedule/Legend'
import { FilterBar } from '../components/shared/FilterBar'
import { ExportButton } from '../components/shared/ExportButton'
import { LoginModal } from '../components/auth/LoginModal'
import { SlotEditModal } from '../components/modals/SlotEditModal'
import { CapacityModal } from '../components/modals/CapacityModal'
import type { ModalTarget } from '../types'

export function SchedulePage() {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [highlightName, setHighlightName] = useState('')
  const [showLogin, setShowLogin] = useState(false)
  const [showCapacity, setShowCapacity] = useState(false)
  const [modalTarget, setModalTarget] = useState<ModalTarget | null>(null)

  const { profile, signIn, signOut } = useAuth()
  const { assignments, slotSettings, scheduleRules, dateOverrides, loading, addAssignment, updateAssignment, deleteAssignment, updateSlotCapacity } = useSchedule(year, month)

  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 12) { setYear(y => y + 1); setMonth(1) }
    else setMonth(m => m + 1)
  }

  const selectedCellState = modalTarget
    ? getCellState(modalTarget.day, modalTarget.timeSlot, year, month, scheduleRules, slotSettings, dateOverrides, assignments)
    : null

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-full mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
          <FilterBar value={highlightName} onChange={setHighlightName} />
          <div className="flex items-center gap-2">
            <ExportButton targetId="schedule-grid-container" year={year} month={month} />
            {profile ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">{profile.name} ({profile.role === 'admin' ? '관리자' : '봉사자'})</span>
                {profile.role === 'admin' && (
                  <button onClick={() => setShowCapacity(true)} className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50">
                    인원 설정
                  </button>
                )}
                <button onClick={signOut} className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50">
                  로그아웃
                </button>
              </div>
            ) : (
              <button onClick={() => setShowLogin(true)} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">
                로그인
              </button>
            )}
          </div>
        </div>

        <div id="schedule-grid-container" className="bg-white rounded-lg shadow p-4">
          <ScheduleHeader year={year} month={month} onPrev={prevMonth} onNext={nextMonth} />
          <Legend />
          {loading ? (
            <div className="flex items-center justify-center h-64 text-gray-400">로딩 중...</div>
          ) : (
            <>
              <div className="hidden md:block">
                <ScheduleGrid
                  year={year} month={month}
                  assignments={assignments} slotSettings={slotSettings}
                  scheduleRules={scheduleRules} dateOverrides={dateOverrides}
                  highlightName={highlightName || null}
                  onCellClick={setModalTarget}
                />
              </div>
              <div className="block md:hidden">
                <MobileScheduleView
                  year={year} month={month}
                  assignments={assignments} slotSettings={slotSettings}
                  scheduleRules={scheduleRules} dateOverrides={dateOverrides}
                  highlightName={highlightName || null}
                  onCellClick={setModalTarget}
                />
              </div>
            </>
          )}
        </div>
      </div>

      {showLogin && <LoginModal onClose={() => setShowLogin(false)} onSignIn={signIn} />}

      {modalTarget && selectedCellState && (
        <SlotEditModal
          target={modalTarget}
          cellState={selectedCellState}
          profile={profile}
          onClose={() => setModalTarget(null)}
          onAdd={(name, note) => addAssignment({
            year, month, day: modalTarget.day,
            time_slot: modalTarget.timeSlot,
            volunteer_name: name,
            note: note || undefined,
            user_id: profile!.id
          })}
          onUpdate={(id, name, note) => updateAssignment(id, { volunteer_name: name, note })}
          onDelete={deleteAssignment}
        />
      )}

      {showCapacity && profile?.role === 'admin' && (
        <CapacityModal slotSettings={slotSettings} onClose={() => setShowCapacity(false)} onUpdate={updateSlotCapacity} />
      )}
    </div>
  )
}
