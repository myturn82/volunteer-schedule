import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { ROLE_LABELS } from '../types'
import { useSchedule } from '../hooks/useSchedule'
import { useProfiles } from '../hooks/useProfiles'
import { getCellState } from '../utils/cellState'
import { ScheduleHeader } from '../components/schedule/ScheduleHeader'
import { ScheduleGrid } from '../components/schedule/ScheduleGrid'
import { Legend } from '../components/schedule/Legend'
import { FilterBar } from '../components/shared/FilterBar'
import { ExportButton } from '../components/shared/ExportButton'
import { LoginModal } from '../components/auth/LoginModal'
import { SlotEditModal } from '../components/modals/SlotEditModal'
import { CapacityModal } from '../components/modals/CapacityModal'
import { HolidayNoteModal } from '../components/modals/HolidayNoteModal'
import type { ModalTarget } from '../types'

interface Props {
  isDark: boolean
  onToggleDark: () => void
}

export function SchedulePage({ isDark, onToggleDark }: Props) {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [highlightName, setHighlightName] = useState('')
  const [showLogin, setShowLogin] = useState(false)
  const [showCapacity, setShowCapacity] = useState(false)
  const [modalTarget, setModalTarget] = useState<ModalTarget | null>(null)
  const [holidayTarget, setHolidayTarget] = useState<{ day: number; startHour: number; endHour: number } | null>(null)

  const navigate = useNavigate()
  const { profile, loading: authLoading, signIn, signUp, signInWithGoogle, signInWithKakao, signOut } = useAuth()

  useEffect(() => {
    if (!authLoading && !profile) setShowLogin(true)
    if (profile) setShowLogin(false)
  }, [authLoading, profile])

  const { assignments, slotSettings, scheduleRules, dateOverrides, loading, addAssignment, updateAssignment, deleteAssignment, updateSlotCapacity } = useSchedule(year, month)
  const { profiles } = useProfiles()
  const teamLeaderUserIds = new Set(profiles.filter(p => p.role === 'team_leader').map(p => p.id))

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
    <div className="min-h-[100dvh] bg-[var(--color-bg)]">
      {/* Sticky glass toolbar */}
      <header className="sticky top-0 z-30 px-2 pt-2 pb-1 sm:px-4 sm:pt-3 sm:pb-2">
        <div className="bg-[var(--color-surface)]/90 backdrop-blur-xl border border-[var(--color-border)] rounded-2xl shadow-[var(--shadow-md)] px-3 py-2 sm:px-4 sm:py-2.5 flex flex-wrap items-center gap-2 justify-between">
          <FilterBar value={highlightName} onChange={setHighlightName} />

          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={onToggleDark}
              aria-label="다크모드 토글"
              className="w-8 h-8 flex items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] transition-all duration-200 hover:scale-[1.05] active:scale-[0.95]"
            >
              <span className="text-sm leading-none">{isDark ? '☀️' : '🌙'}</span>
            </button>

            <ExportButton year={year} month={month} />

            {profile ? (
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs text-[var(--color-text-secondary)] font-medium px-2.5 py-1 bg-[var(--color-surface-secondary)] rounded-xl border border-[var(--color-border)]">
                  {profile.name}
                  <span className="ml-1 text-[var(--color-text-muted)]">· {ROLE_LABELS[profile.role]}</span>
                </span>

                {profile.role === 'admin' && (
                  <button
                    onClick={() => navigate('/admin')}
                    className="px-3 py-1.5 text-xs font-medium rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                  >
                    관리자
                  </button>
                )}
                {(profile.role === 'admin' || profile.role === 'team_leader') && (
                  <button
                    onClick={() => setShowCapacity(true)}
                    className="px-3 py-1.5 text-xs font-medium rounded-xl border border-[var(--color-border)] text-[var(--color-text-secondary)] bg-[var(--color-surface-secondary)] hover:bg-[var(--color-surface-hover)] transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                  >
                    인원 설정
                  </button>
                )}

                <button
                  onClick={signOut}
                  className="px-3 py-1.5 text-xs font-medium rounded-xl border border-[var(--color-border)] text-[var(--color-text-muted)] bg-[var(--color-surface-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-secondary)] transition-all duration-200"
                >
                  로그아웃
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowLogin(true)}
                className="px-4 py-1.5 text-sm font-semibold rounded-xl bg-[var(--color-brand-primary)] text-white hover:bg-[var(--color-brand-primary-hover)] transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] shadow-[0_2px_10px_rgba(37,99,235,0.35)]"
              >
                로그인
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="px-2 py-2 sm:px-4 sm:py-3">
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-[var(--shadow-lg)] overflow-hidden animate-fade-up">
          <div className="px-3 py-3 sm:px-5 sm:py-4 border-b border-[var(--color-border)]">
            <ScheduleHeader year={year} month={month} onPrev={prevMonth} onNext={nextMonth} />
            <Legend />
          </div>

          <div className="p-1.5 sm:p-3">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-64 gap-3">
                <div className="w-8 h-8 border-2 border-[var(--color-brand-primary)] border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-[var(--color-text-muted)]">스케줄을 불러오는 중...</span>
              </div>
            ) : (
              <ScheduleGrid
                year={year} month={month}
                assignments={assignments} slotSettings={slotSettings}
                scheduleRules={scheduleRules} dateOverrides={dateOverrides}
                highlightName={highlightName || null}
                profile={profile}
                teamLeaderUserIds={teamLeaderUserIds}
                onCellClick={target => {
                  const role = profile?.role
                  const targetIsSaturday = new Date(target.year, target.month - 1, target.day).getDay() === 6
                  if (role === 'volunteer' && target.volunteerType !== 'volunteer') return
                  if (role === '50plus' && target.volunteerType !== '50plus' && !targetIsSaturday) return
                  setModalTarget(target)
                }}
                onHolidayCellClick={profile && (profile.role === 'admin' || profile.role === 'team_leader')
                  ? (day, startHour, endHour) => setHolidayTarget({ day, startHour, endHour })
                  : undefined}
              />
            )}
          </div>
        </div>
      </main>

      {showLogin && (
        <LoginModal
          onClose={() => { if (profile) setShowLogin(false) }}
          onSignIn={signIn}
          onSignUp={signUp}
          onGoogle={signInWithGoogle}
          onKakao={signInWithKakao}
          hideCancelButton={!profile}
        />
      )}

      {modalTarget && selectedCellState && (
        <SlotEditModal
          target={modalTarget}
          cellState={selectedCellState}
          profile={profile}
          onClose={() => setModalTarget(null)}
          onAdd={(name, note, volunteerType, timeSub, color, userId) => addAssignment({
            year, month, day: modalTarget.day,
            time_slot: modalTarget.timeSlot,
            volunteer_name: name,
            note: note?.trim() || undefined,
            volunteer_type: volunteerType,
            time_sub: timeSub || undefined,
            color: color || undefined,
            user_id: userId ?? profile!.id
          })}
          onUpdate={(id, name, note, volunteerType, timeSub, color) => updateAssignment(id, { volunteer_name: name, note, volunteer_type: volunteerType, time_sub: timeSub ?? undefined, color: color ?? undefined })}
          onDelete={deleteAssignment}
        />
      )}

      {showCapacity && profile && (profile.role === 'admin' || profile.role === 'team_leader') && (
        <CapacityModal slotSettings={slotSettings} onClose={() => setShowCapacity(false)} onUpdate={updateSlotCapacity} />
      )}

      {holidayTarget !== null && profile && (profile.role === 'admin' || profile.role === 'team_leader') && (
        <HolidayNoteModal
          year={year} month={month} day={holidayTarget.day}
          assignments={assignments}
          profile={profile}
          initialStartHour={holidayTarget.startHour}
          initialEndHour={holidayTarget.endHour}
          onClose={() => setHolidayTarget(null)}
          onAdd={addAssignment}
          onUpdate={(id, params) => updateAssignment(id, params)}
          onDelete={deleteAssignment}
        />
      )}
    </div>
  )
}
