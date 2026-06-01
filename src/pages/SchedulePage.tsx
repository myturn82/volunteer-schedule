import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useTenant } from '../contexts/TenantContext'
import { useSchedule } from '../hooks/useSchedule'
import { useProfiles } from '../hooks/useProfiles'
import type { ProfileWithRole } from '../hooks/useProfiles'
import { useTenantRoles } from '../hooks/useTenantRoles'
import { getCellState } from '../utils/cellState'
import { getTimeSubOptions } from '../utils/timeSlots'
import { AppHeader } from '../components/AppHeader'
import { ScheduleHeader } from '../components/schedule/ScheduleHeader'
import { ScheduleGrid } from '../components/schedule/ScheduleGrid'
import { WeekGrid } from '../components/schedule/WeekGrid'
import { DayView } from '../components/schedule/DayView'
import { Legend } from '../components/schedule/Legend'
import { FilterBar } from '../components/shared/FilterBar'
import { ExportButton } from '../components/shared/ExportButton'
import { LoginModal } from '../components/auth/LoginModal'
import { SlotEditModal } from '../components/modals/SlotEditModal'
import { CapacityModal } from '../components/modals/CapacityModal'
import { HolidayNoteModal } from '../components/modals/HolidayNoteModal'
import { ConfirmDialog } from '../components/shared/ConfirmDialog'
import { AutoAssignPreviewModal } from '../components/modals/AutoAssignPreviewModal'
import { computeAutoAssignments } from '../utils/autoAssign'
import type { ProposedAssignment, MemberPreference } from '../utils/autoAssign'
import type { ModalTarget, ViewType, TenantMode, Assignment } from '../types'

export function SchedulePage() {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [day, setDay] = useState(today.getDate())
  const [viewType, setViewType] = useState<ViewType>('month')
  const [highlightName, setHighlightName] = useState('')
  const [showLogin, setShowLogin] = useState(false)
  const [showCapacity, setShowCapacity] = useState(false)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [showNoClearTarget, setShowNoClearTarget] = useState(false)
  const [autoProposals, setAutoProposals] = useState<ProposedAssignment[] | null>(null)
  const [modalTarget, setModalTarget] = useState<ModalTarget | null>(null)
  const [directRegMsg, setDirectRegMsg] = useState<string | null>(null)
  const [holidayTarget, setHolidayTarget] = useState<{ day: number; startHour: number; endHour: number } | null>(null)
  const [memberNotice, setMemberNotice] = useState<string | null>(null)

  const [filterMemberId, setFilterMemberId] = useState<string | null>(null)

  const { profile, loading: authLoading, signIn, signUp, signInWithGoogle, signInWithKakao } = useAuth()
  const { tenant, tenantRole, memberships, timeSlots, slotLabels, legendItems, customFields, typeLabels } = useTenant()
  const memberRoleId = memberships.find(m => m.tenant_id === tenant?.id)?.role_id ?? null
  const isPrivileged = profile?.is_super_admin || tenantRole === 'admin'
  const rawMode = tenant?.settings?.tenant_mode ?? '회원선택'
  const tenantMode: TenantMode =
    rawMode === '회원선택' ? '회원공유' :
    rawMode === '직접입력' ? '비회원' :
    rawMode as TenantMode

  const displayAssignmentFilter = useMemo<((a: Assignment) => boolean) | undefined>(() => {
    if (tenantMode !== '회원개별') return undefined
    if (isPrivileged) {
      return filterMemberId ? (a: Assignment) => a.user_id === filterMemberId : undefined
    }
    return (a: Assignment) => a.user_id === (profile?.id ?? '')
  }, [tenantMode, isPrivileged, filterMemberId, profile?.id])

  const withdrawnUserIds = useMemo(() => new Set(
    memberships
      .filter(m => m.tenant_id === tenant?.id && m.withdrawal_status === 'approved')
      .map(m => m.user_id)
  ), [memberships, tenant?.id])

  const memberPreferences = useMemo(() => {
    const map = new Map<string, MemberPreference>()
    for (const m of memberships) {
      if (m.tenant_id === tenant?.id) {
        map.set(m.user_id, {
          availableDays: m.available_days,
          monthlyLimit: m.monthly_limit,
        })
      }
    }
    return map
  }, [memberships, tenant?.id])

  useEffect(() => {
    if (!authLoading && !profile) setShowLogin(true)
    if (profile) setShowLogin(false)
  }, [authLoading, profile])

  // 소셜 회원가입 탭에서 이미 가입된 조직 감지 → localStorage 플래그 수거
  useEffect(() => {
    if (!profile) return
    const notice = localStorage.getItem('vs_notice_already_member')
    if (notice) {
      localStorage.removeItem('vs_notice_already_member')
      setMemberNotice(notice)
    }
  }, [profile?.id])

  // 주 뷰에서 월 경계를 넘는 경우 인접 월도 로드
  // 해당 주의 일요일(마지막 날) 계산: 월요일 기준 주이므로 월요일 + 6일
  const _anchorDow = new Date(year, month - 1, day).getDay()
  const _mondayOffset = (_anchorDow + 6) % 7  // 월요일까지 가야 하는 일수
  const _sundayDate = new Date(year, month - 1, day - _mondayOffset + 6)
  const adjYear = _sundayDate.getFullYear()
  const adjMonth = _sundayDate.getMonth() + 1
  const needsAdj = viewType === 'week' && (adjYear !== year || adjMonth !== month)

  const { assignments: primaryAssignments, slotSettings, scheduleRules, dateOverrides, loading, addAssignment, updateAssignment, deleteAssignment, clearAssignments, updateSlotCapacity } = useSchedule(tenant?.id ?? '', year, month)
  const { assignments: adjAssignments, clearAssignments: clearAdjAssignments } = useSchedule(needsAdj ? (tenant?.id ?? '') : '', adjYear, adjMonth)
  const assignments = needsAdj ? [...primaryAssignments, ...adjAssignments] : primaryAssignments
  const { profiles } = useProfiles()
  const teamLeaderUserIds = new Set<string>()
  const { roles: tenantRoles } = useTenantRoles(tenant?.id ?? '')
  const splitRoles = tenantRoles.filter(r => r.split_cell && !r.indicator_bar)
  const indicatorBarRoles = tenantRoles.filter(r => r.indicator_bar)
  const isSplitMode = splitRoles.length > 0
  // 역할 배정 모달용: split_cell 또는 indicator_bar가 true인 역할 모두 포함
  const memberTenantRoleName = tenantRoles.find(r => r.id === memberRoleId)?.name ?? null

  const filledCount = useMemo(
    () => assignments.filter(a => a.volunteer_type !== 'admin_note').length,
    [assignments]
  )
  const operatingDays = useMemo(() => {
    const daysInMonth = new Date(year, month, 0).getDate()
    let count = 0
    for (let d = 1; d <= daysInMonth; d++) {
      const dow = new Date(year, month - 1, d).getDay()
      if (dow !== 0) count++
    }
    return count
  }, [year, month])

  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 12) { setYear(y => y + 1); setMonth(1) }
    else setMonth(m => m + 1)
  }

  function shiftDate(delta: number) {
    const d = new Date(year, month - 1, day)
    d.setDate(d.getDate() + delta)
    setYear(d.getFullYear())
    setMonth(d.getMonth() + 1)
    setDay(d.getDate())
  }

  function getWeekDays(y: number, m: number, d: number): Date[] {
    const anchor = new Date(y, m - 1, d)
    const dow = anchor.getDay()
    const monday = new Date(anchor)
    monday.setDate(anchor.getDate() - ((dow + 6) % 7))
    return Array.from({ length: 7 }, (_, i) => {
      const dd = new Date(monday)
      dd.setDate(monday.getDate() + i)
      return dd
    })
  }

  const weekDays = getWeekDays(year, month, day)

  function getTargetDays(): Date[] {
    if (viewType === 'month') {
      const count = new Date(year, month, 0).getDate()
      return Array.from({ length: count }, (_, i) => new Date(year, month - 1, i + 1))
    }
    if (viewType === 'week') return weekDays
    return [new Date(year, month - 1, day)]
  }

  function handleAutoAssign() {
    if (tenantMode === '비회원') return
    const proposals = computeAutoAssignments({
      days: getTargetDays(),
      timeSlots,
      assignments,
      slotSettings,
      scheduleRules,
      dateOverrides,
      profiles,
      splitRoles,
      isSplitMode,
      memberPreferences,
      roleRatios: tenant?.settings?.role_ratios,
      volunteerLabel: typeLabels.volunteer,
    })
    if (!proposals.length) {
      alert('배정할 빈 슬롯이 없거나 배정 가능한 회원이 없습니다.')
      return
    }
    setAutoProposals(proposals)
  }

  function handleClearClick() {
    const hasClearTarget = viewType === 'month'
      ? assignments.some(a => a.year === year && a.month === month)
      : viewType === 'week'
      ? assignments.some(a => weekDays.some(d => d.getFullYear() === a.year && d.getMonth() + 1 === a.month && d.getDate() === a.day))
      : assignments.some(a => a.year === year && a.month === month && a.day === day)
    if (!hasClearTarget) { setShowNoClearTarget(true); return }
    setShowClearConfirm(true)
  }

  async function handleCellClick(target: ModalTarget) {
    if (isSplitMode && tenantRole === 'member') {
      if (!memberRoleId || target.roleId !== memberRoleId) return
    }

    if (
      tenantMode !== '비회원' &&
      !isPrivileged &&
      profile &&
      !getTimeSubOptions(target.timeSlot)
    ) {
      const cs = getCellState(
        target.day, target.timeSlot, target.year, target.month,
        scheduleRules, slotSettings, dateOverrides, assignments
      )
      if (!cs.isClosed && !cs.isHoliday && !cs.isBreaktime) {
        const alreadyIn = cs.assignments.some(a => a.user_id === profile.id)
        if (!alreadyIn) {
          const roleAssigns = target.roleId
            ? cs.assignments.filter(a => a.role_id === target.roleId)
            : cs.assignments
          const remaining = cs.maxCapacity - roleAssigns.length
          const roleProfileCount = target.roleId
            ? (profiles as ProfileWithRole[]).filter(p => p.tenantRoleId === target.roleId).length
            : 0
          const shouldSkipPopup = cs.maxCapacity === 1 || remaining === 1 || roleProfileCount === 1
          if (remaining > 0 && shouldSkipPopup) {
            const err = await addAssignment({
              tenant_id: tenant!.id,
              year: target.year, month: target.month, day: target.day,
              time_slot: target.timeSlot,
              volunteer_name: profile.name,
              volunteer_type: 'volunteer',
              user_id: profile.id,
              role_id: target.roleId ?? null,
              note: undefined,
              time_sub: undefined,
              color: undefined,
              customer_name: null,
              customer_phone: null,
            })
            if (!err) {
              setDirectRegMsg('등록되었습니다')
              setTimeout(() => setDirectRegMsg(null), 2000)
            }
            return
          }
        }
      }
    }

    setModalTarget(target)
  }

  const selectedCellState = modalTarget
    ? getCellState(modalTarget.day, modalTarget.timeSlot, modalTarget.year, modalTarget.month, scheduleRules, slotSettings, dateOverrides, assignments)
    : null

  const menuItemCls = 'w-full text-left px-3 py-2 text-sm rounded-xl text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] transition-colors'

  return (
    <div className="min-h-[100dvh] bg-[var(--color-bg)]">
      <AppHeader
        leftSlot={<FilterBar value={highlightName} onChange={setHighlightName} />}
        rightSlot={<ExportButton year={year} month={month} />}
        roleLabel={memberTenantRoleName ?? undefined}
        funcMenuItems={(close) => (
          <>
            <button onClick={() => { setShowCapacity(true); close() }} className={menuItemCls}>
              <span className="flex items-center gap-2.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                인원 설정
              </span>
            </button>
            {tenantMode === '회원개별' && isPrivileged && (
              <select
                value={filterMemberId ?? ''}
                onChange={e => setFilterMemberId(e.target.value || null)}
                className="px-2 py-1 text-xs border border-[var(--color-border)] rounded-lg bg-[var(--color-surface)] text-[var(--color-text-secondary)]"
              >
                <option value="">전체 회원</option>
                {profiles.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            )}
            {tenantMode !== '비회원' && (
              <button onClick={() => { handleAutoAssign(); close() }} className={menuItemCls}>
                <span className="flex items-center gap-2.5">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 11.8 19 13M17.8 6.2 19 5M12.2 6.2 11 5M12.2 11.8 11 13"/><path d="M3 21l9-9"/><path d="M12.2 6.2 3 15l3 3 9.2-9.2"/></svg>
                  자동배정
                </span>
              </button>
            )}
            <div className="h-px bg-[var(--color-border)] mx-1 my-1" />
            <button onClick={() => { handleClearClick(); close() }} className={menuItemCls}>
              <span className="flex items-center gap-2.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                초기화
              </span>
            </button>
          </>
        )}
        onShowLogin={() => setShowLogin(true)}
      />
      {memberNotice && (
        <div className="flex items-center justify-between gap-2 mx-3 mt-2 sm:mx-5 px-3 py-2 rounded-xl bg-blue-50 border border-blue-200 text-sm text-blue-700">
          <span>{memberNotice}</span>
          <button onClick={() => setMemberNotice(null)} className="shrink-0 text-blue-400 hover:text-blue-600 transition-colors">
            <svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 5l10 10M15 5L5 15"/></svg>
          </button>
        </div>
      )}
      {/* Main content */}
      <main className="px-2 py-2 sm:px-4 sm:py-3">
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-[var(--shadow-lg)] overflow-hidden animate-fade-up">
          <div className="px-3 py-3 sm:px-5 sm:py-4 border-b border-[var(--color-border)]">
            <ScheduleHeader
              year={year} month={month} day={day}
              title={tenant?.name}
              filledCount={filledCount}
              operatingDays={operatingDays}
              viewType={viewType}
              onViewTypeChange={setViewType}
              weekDays={weekDays}
              onPrev={() => viewType === 'month' ? prevMonth() : shiftDate(viewType === 'week' ? -7 : -1)}
              onNext={() => viewType === 'month' ? nextMonth() : shiftDate(viewType === 'week' ? 7 : 1)}
            />
            <Legend legendItems={legendItems} />
          </div>

          <div className="p-1.5 sm:p-3">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-64 gap-3">
                <div className="w-8 h-8 border-2 border-[var(--color-brand-primary)] border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-[var(--color-text-muted)]">스케줄을 불러오는 중...</span>
              </div>
            ) : viewType === 'month' ? (
              <ScheduleGrid
                year={year} month={month}
                timeSlots={timeSlots}
                assignments={assignments} slotSettings={slotSettings}
                scheduleRules={scheduleRules} dateOverrides={dateOverrides}
                highlightName={highlightName || null}
                profile={profile}
                tenantRole={tenantRole}
                memberRoleId={memberRoleId}
                teamLeaderUserIds={teamLeaderUserIds}
                splitRoles={splitRoles}
                indicatorBarRoles={indicatorBarRoles}
                isSplitMode={isSplitMode}
                slotLabels={slotLabels}
                onCellClick={handleCellClick}
                onHolidayCellClick={profile && isPrivileged
                  ? (d, startHour, endHour) => setHolidayTarget({ day: d, startHour, endHour })
                  : undefined}
                displayAssignmentFilter={displayAssignmentFilter}
                withdrawnUserIds={withdrawnUserIds}
              />
            ) : viewType === 'week' ? (
              <WeekGrid
                weekDays={weekDays}
                timeSlots={timeSlots}
                assignments={assignments} slotSettings={slotSettings}
                scheduleRules={scheduleRules} dateOverrides={dateOverrides}
                highlightName={highlightName || null}
                profile={profile}
                splitRoles={splitRoles}
                indicatorBarRoles={indicatorBarRoles}
                isSplitMode={isSplitMode}
                slotLabels={slotLabels}
                selectedDay={new Date(year, month - 1, day)}
                memberRoleId={memberRoleId}
                tenantRole={tenantRole}
                teamLeaderUserIds={teamLeaderUserIds}
                isPrivileged={isPrivileged}
                onDateHeaderClick={d => {
                  setYear(d.getFullYear())
                  setMonth(d.getMonth() + 1)
                  setDay(d.getDate())
                }}
                onCellClick={handleCellClick}
                displayAssignmentFilter={displayAssignmentFilter}
                withdrawnUserIds={withdrawnUserIds}
              />
            ) : (
              <DayView
                year={year} month={month} day={day}
                timeSlots={timeSlots}
                assignments={assignments} slotSettings={slotSettings}
                scheduleRules={scheduleRules} dateOverrides={dateOverrides}
                profile={profile}
                splitRoles={splitRoles}
                isSplitMode={isSplitMode}
                slotLabels={slotLabels}
                onCellClick={handleCellClick}
                displayAssignmentFilter={displayAssignmentFilter}
                withdrawnUserIds={withdrawnUserIds}
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
          tenantRole={tenantRole}
          memberRoleId={memberRoleId}
          splitRoles={[...splitRoles, ...indicatorBarRoles]}
          isSplitMode={isSplitMode}
          tenantRoles={tenantRoles}
          tenantMode={tenantMode}
          customFields={customFields}
          slotLabels={slotLabels}
          typeLabels={typeLabels}
          onClose={() => setModalTarget(null)}
          onAdd={(name, note, volunteerType, timeSub, color, userId, roleId, customerName, customerPhone, extraData) => addAssignment({
            tenant_id: tenant!.id,
            year, month, day: modalTarget.day,
            time_slot: modalTarget.timeSlot,
            volunteer_name: name,
            note: note?.trim() || undefined,
            volunteer_type: volunteerType,
            time_sub: timeSub || undefined,
            color: color || undefined,
            user_id: userId ?? profile!.id,
            role_id: roleId ?? null,
            customer_name: customerName ?? null,
            customer_phone: customerPhone ?? null,
            extra_data: extraData,
          })}
          onUpdate={(id, name, note, volunteerType, timeSub, color, roleId, customerName, customerPhone, extraData) => updateAssignment(id, {
            volunteer_name: name,
            note,
            volunteer_type: volunteerType,
            time_sub: timeSub ?? undefined,
            color: color ?? undefined,
            role_id: roleId ?? null,
            customer_name: customerName ?? null,
            customer_phone: customerPhone ?? null,
            extra_data: extraData,
          })}
          onDelete={deleteAssignment}
        />
      )}

      {autoProposals !== null && (
        <AutoAssignPreviewModal
          proposals={autoProposals}
          onClose={() => setAutoProposals(null)}
          onConfirm={async (selected) => {
            const errors: string[] = []
            for (const p of selected) {
              const err = await addAssignment({
                tenant_id: tenant!.id,
                year: p.year,
                month: p.month,
                day: p.day,
                time_slot: p.timeSlot,
                volunteer_name: p.userName,
                volunteer_type: p.volunteerType,
                user_id: p.userId,
                role_id: p.roleId ?? null,
              })
              if (err) errors.push(err)
            }
            setAutoProposals(null)
            if (errors.length) {
              alert(`${selected.length - errors.length}건 저장 완료, ${errors.length}건 실패`)
            }
          }}
        />
      )}

      {showNoClearTarget && (
        <ConfirmDialog
          title="초기화 대상 없음"
          message="해당 기간에 초기화할 스케줄이 없습니다."
          confirmLabel="확인"
          hideCancelButton
          onConfirm={() => setShowNoClearTarget(false)}
          onCancel={() => setShowNoClearTarget(false)}
        />
      )}

      {showClearConfirm && (
        <ConfirmDialog
          title="스케줄 초기화"
          message={
            viewType === 'month'
              ? `${year}년 ${month}월 스케줄을 전체 삭제합니다.\n이 작업은 되돌릴 수 없습니다.`
              : viewType === 'week'
              ? `${weekDays[0].getMonth() + 1}월 ${weekDays[0].getDate()}일 ~ ${weekDays[6].getMonth() + 1}월 ${weekDays[6].getDate()}일\n해당 주의 스케줄을 삭제합니다.\n이 작업은 되돌릴 수 없습니다.`
              : `${year}년 ${month}월 ${day}일 스케줄을 삭제합니다.\n이 작업은 되돌릴 수 없습니다.`
          }
          confirmLabel="삭제"
          cancelLabel="취소"
          danger
          onCancel={() => setShowClearConfirm(false)}
          onConfirm={async () => {
            setShowClearConfirm(false)
            let err: string | null = null
            if (viewType === 'month') {
              err = await clearAssignments()
            } else if (viewType === 'day') {
              err = await clearAssignments([day])
            } else {
              // week: split days by month
              const primaryDays = weekDays.filter(d => d.getFullYear() === year && d.getMonth() + 1 === month).map(d => d.getDate())
              if (primaryDays.length) err = await clearAssignments(primaryDays)
              if (!err && needsAdj) {
                const adjDays = weekDays.filter(d => d.getFullYear() === adjYear && d.getMonth() + 1 === adjMonth).map(d => d.getDate())
                if (adjDays.length) err = await clearAdjAssignments(adjDays)
              }
            }
            if (err) alert(err)
          }}
        />
      )}

      {showCapacity && profile && isPrivileged && (
        <CapacityModal slotSettings={slotSettings} timeSlots={timeSlots} slotLabels={slotLabels} onClose={() => setShowCapacity(false)} onUpdate={updateSlotCapacity} />
      )}

      {holidayTarget !== null && profile && isPrivileged && (
        <HolidayNoteModal
          year={year} month={month} day={holidayTarget.day}
          assignments={assignments}
          profile={profile}
          initialStartHour={holidayTarget.startHour}
          initialEndHour={holidayTarget.endHour}
          onClose={() => setHolidayTarget(null)}
          onAdd={(params) => addAssignment({ ...params, tenant_id: tenant!.id })}
          onUpdate={(id, params) => updateAssignment(id, params)}
          onDelete={deleteAssignment}
        />
      )}

      {directRegMsg && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl bg-[var(--color-brand-primary)] text-white text-sm font-medium shadow-lg animate-fade-up pointer-events-none">
          {directRegMsg}
        </div>
      )}
    </div>
  )
}
