import { useState, useMemo, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import type { Profile, TenantRole, ScheduleRule, DateOverride, TenantMode, TenantAccessRole } from '../../types'
import type { ProfileWithRole } from '../../hooks/useProfiles'
import { getDatesForPattern, getDatesForDaily, getDatesForMonthly, getDatesForYearly } from '../../utils/recurringDates'
import { parseSlotLabel } from '../../utils/timeSlots'

interface Props {
  tenantId: string
  tenantMode: TenantMode | '직접입력' | '회원선택'
  timeSlots: string[]
  slotLabels: Record<string, string>
  scheduleRules: ScheduleRule[]
  dateOverrides: DateOverride[]
  profile: Profile | null
  tenantRole: TenantAccessRole | null
  profiles: ProfileWithRole[]
  splitRoles?: TenantRole[]
  isSplitMode?: boolean
  initialYear: number
  initialMonth: number
  onClose: () => void
  onSuccess: (inserted: number, skipped: number) => void
}

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']

export function RecurringModal({
  tenantId, tenantMode, timeSlots, slotLabels,
  scheduleRules, dateOverrides, profile, tenantRole,
  profiles, splitRoles = [], isSplitMode = false,
  initialYear, initialMonth,
  onClose, onSuccess,
}: Props) {
  const isAdmin = profile?.is_super_admin || tenantRole === 'admin'
  const isFreeform = tenantMode === '비회원' || tenantMode === '직접입력'

  // Regular member's role (looked up from profiles list)
  const myRoleId = !isAdmin
    ? (profiles.find(p => p.id === profile?.id)?.tenantRoleId ?? null)
    : null

  type RepeatType = 'daily' | 'weekly' | 'monthly' | 'yearly'
  const [repeatType, setRepeatType] = useState<RepeatType>('weekly')
  const [dayOfMonth, setDayOfMonth] = useState(new Date().getDate())
  const [monthOfYear, setMonthOfYear] = useState(new Date().getMonth() + 1)
  const [selectedDays, setSelectedDays] = useState<number[]>([])
  const [selectedSlots, setSelectedSlots] = useState<string[]>([])
  type RangeMode = 'this' | 'next' | '3months' | '6months' | '1year' | '2years' | '3years' | 'custom'
  const [rangeMode, setRangeMode] = useState<RangeMode>('this')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [volunteerName, setVolunteerName] = useState(!isAdmin ? (profile?.name ?? '') : '')
  const [selectedUserId, setSelectedUserId] = useState<string | null>(!isAdmin ? (profile?.id ?? null) : null)
  const [roleId, setRoleId] = useState<string | null>(myRoleId)
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 반복 유형 변경 시 기간 옵션 초기화
  useEffect(() => {
    if (repeatType === 'monthly') setRangeMode('3months')
    else if (repeatType === 'yearly') setRangeMode('1year')
    else setRangeMode('this')
  }, [repeatType])

  const { startDate, endDate } = useMemo(() => {
    const thisStart = new Date(initialYear, initialMonth - 1, 1)
    if (rangeMode === 'this') {
      return { startDate: thisStart, endDate: new Date(initialYear, initialMonth, 0) }
    }
    if (rangeMode === 'next') {
      const y = initialMonth === 12 ? initialYear + 1 : initialYear
      const m = initialMonth === 12 ? 1 : initialMonth + 1
      return { startDate: new Date(y, m - 1, 1), endDate: new Date(y, m, 0) }
    }
    if (rangeMode === '3months') {
      return { startDate: thisStart, endDate: new Date(initialYear, initialMonth + 2, 0) }
    }
    if (rangeMode === '6months') {
      return { startDate: thisStart, endDate: new Date(initialYear, initialMonth + 5, 0) }
    }
    if (rangeMode === '1year') {
      return { startDate: thisStart, endDate: new Date(initialYear, initialMonth + 11, 0) }
    }
    if (rangeMode === '2years') {
      return { startDate: thisStart, endDate: new Date(initialYear, initialMonth + 23, 0) }
    }
    if (rangeMode === '3years') {
      return { startDate: thisStart, endDate: new Date(initialYear, initialMonth + 35, 0) }
    }
    return {
      startDate: customStart ? new Date(customStart) : thisStart,
      endDate: customEnd ? new Date(customEnd) : new Date(initialYear, initialMonth, 0),
    }
  }, [rangeMode, customStart, customEnd, initialYear, initialMonth])

  // 선택된 요일 기준으로 open인 슬롯만 표시
  const availableSlots = useMemo(() => {
    return timeSlots.filter(slot => {
      if (selectedDays.length === 0) {
        const slotRules = scheduleRules.filter(r => r.time_slot === slot)
        return slotRules.length === 0 || slotRules.some(r => r.is_open)
      }
      return selectedDays.some(dow => {
        const rule = scheduleRules.find(r => r.day_of_week === dow && r.time_slot === slot)
        return !rule || rule.is_open
      })
    })
  }, [timeSlots, scheduleRules, selectedDays])

  // 사용 불가 슬롯이 selectedSlots에 남아 있으면 자동 제거
  useEffect(() => {
    setSelectedSlots(prev => prev.filter(s => availableSlots.includes(s)))
  }, [availableSlots])

  // (date, slot) pairs across all selected slots
  const targetPairs = useMemo(() => {
    if (!selectedSlots.length) return []
    return selectedSlots.flatMap(slot => {
      let dates: { year: number; month: number; day: number }[] = []
      if (repeatType === 'daily') {
        dates = getDatesForDaily(startDate, endDate, slot, scheduleRules, dateOverrides)
      } else if (repeatType === 'weekly') {
        if (!selectedDays.length) return []
        dates = getDatesForPattern(startDate, endDate, selectedDays, slot, scheduleRules, dateOverrides)
      } else if (repeatType === 'monthly') {
        dates = getDatesForMonthly(startDate, endDate, dayOfMonth, slot, scheduleRules, dateOverrides)
      } else {
        dates = getDatesForYearly(startDate, endDate, monthOfYear, dayOfMonth, slot, scheduleRules, dateOverrides)
      }
      return dates.map(d => ({ ...d, time_slot: slot }))
    })
  }, [repeatType, selectedDays, selectedSlots, dayOfMonth, monthOfYear, startDate, endDate, scheduleRules, dateOverrides])

  // Unique dates (for preview)
  const uniqueDateKeys = useMemo(
    () => [...new Set(targetPairs.map(p => `${p.year}-${p.month}-${p.day}`))],
    [targetPairs]
  )

  function toggleDay(dow: number) {
    setSelectedDays(prev => prev.includes(dow) ? prev.filter(d => d !== dow) : [...prev, dow])
  }

  function toggleSlot(slot: string) {
    setSelectedSlots(prev => prev.includes(slot) ? prev.filter(s => s !== slot) : [...prev, slot])
  }

  async function handleSubmit() {
    setError(null)
    if (repeatType === 'weekly' && !selectedDays.length) { setError('요일을 선택해주세요'); return }
    if (!selectedSlots.length) { setError('시간대를 선택해주세요'); return }
    if (!volunteerName.trim()) { setError('이름을 입력해주세요'); return }
    if (isAdmin && !isFreeform && !selectedUserId) { setError('회원을 선택해주세요'); return }
    if (!targetPairs.length) { setError('선택한 기간에 등록 가능한 날짜가 없습니다'); return }

    setLoading(true)
    try {
      const years = targetPairs.map(d => d.year)
      // Fetch existing assignments for this volunteer in the year range (all slots)
      const { data: existing } = await supabase
        .from('assignments')
        .select('year, month, day, time_slot')
        .eq('tenant_id', tenantId)
        .eq('member_name', volunteerName.trim())
        .gte('year', Math.min(...years))
        .lte('year', Math.max(...years))

      const existingSet = new Set(
        (existing ?? []).map(e => `${e.year}-${e.month}-${e.day}-${e.time_slot}`)
      )

      const toInsert = targetPairs
        .filter(d => !existingSet.has(`${d.year}-${d.month}-${d.day}-${d.time_slot}`))
        .map(d => ({
          tenant_id: tenantId,
          year: d.year,
          month: d.month,
          day: d.day,
          time_slot: d.time_slot,
          member_name: volunteerName.trim(),
          member_type: 'member',
          user_id: isFreeform ? null : (isAdmin ? selectedUserId : (profile?.id ?? null)),
          role_id: isSplitMode ? roleId : null,
          note: note.trim() || null,
        }))

      const skipped = targetPairs.length - toInsert.length

      if (toInsert.length > 0) {
        const { error: err } = await supabase.from('assignments').insert(toInsert)
        if (err) { setError(err.message); setLoading(false); return }
      }

      onSuccess(toInsert.length, skipped)
    } catch {
      setError('등록 중 오류가 발생했습니다')
    }
    setLoading(false)
  }

  const inputCls = 'w-full border border-[var(--color-border-strong)] rounded-xl px-3 py-2.5 text-sm bg-[var(--color-surface-secondary)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500/60 transition-all duration-200'
  const tabCls = (active: boolean) =>
    `px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${active ? 'bg-[var(--color-brand-primary)] text-white' : 'bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]'}`

  const roleName = isSplitMode && roleId ? splitRoles.find(r => r.id === roleId)?.name ?? null : null
  const previewDates = uniqueDateKeys.slice(0, 10).map(k => {
    const [y, m, d] = k.split('-').map(Number)
    return { year: y, month: m, day: d }
  })

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-hidden">
      <div className="bg-[var(--color-surface)] border border-[var(--color-border-strong)] rounded-2xl shadow-[var(--shadow-xl)] w-full max-w-md animate-scale-in overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)]">

        {/* Header */}
        <div className="flex justify-between items-center px-5 pt-5 pb-3 border-b border-[var(--color-border)] shrink-0">
          <div>
            <h2 className="text-base font-bold text-[var(--color-text-primary)]">반복 등록</h2>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">반복 요일 패턴으로 일괄 등록</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl border border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-secondary)] transition-all duration-200 text-lg leading-none"
          >×</button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">

          {/* 반복 유형 */}
          <div>
            <p className="text-xs font-semibold text-[var(--color-text-secondary)] mb-2">반복 유형</p>
            <div className="grid grid-cols-4 gap-1.5">
              {(['daily','weekly','monthly','yearly'] as RepeatType[]).map(t => (
                <button key={t} onClick={() => setRepeatType(t)} className={tabCls(repeatType === t)}>
                  {t === 'daily' ? '매일' : t === 'weekly' ? '매주' : t === 'monthly' ? '매월' : '매년'}
                </button>
              ))}
            </div>
          </div>

          {/* 요일 선택 (매주만) */}
          {repeatType === 'weekly' && (
          <div>
            <p className="text-xs font-semibold text-[var(--color-text-secondary)] mb-2">
              요일 선택 <span className="text-red-500">*</span>
            </p>
            <div className="flex gap-1.5">
              {DAY_LABELS.map((label, dow) => {
                const active = selectedDays.includes(dow)
                let cls = 'flex-1 py-2 rounded-xl text-xs font-semibold transition-colors '
                if (active) {
                  cls += dow === 0 ? 'bg-red-500 text-white' : dow === 6 ? 'bg-blue-500 text-white' : 'bg-[var(--color-brand-primary)] text-white'
                } else {
                  cls += dow === 0
                    ? 'bg-[var(--color-surface-secondary)] text-red-500 hover:bg-red-50'
                    : dow === 6
                    ? 'bg-[var(--color-surface-secondary)] text-blue-500 hover:bg-blue-50'
                    : 'bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]'
                }
                return (
                  <button key={dow} onClick={() => toggleDay(dow)} className={cls}>
                    {label}
                  </button>
                )
              })}
            </div>
          </div>
          )}

          {/* 월 선택 (매년만) */}
          {repeatType === 'yearly' && (
          <div>
            <p className="text-xs font-semibold text-[var(--color-text-secondary)] mb-2">월 선택</p>
            <div className="grid grid-cols-6 gap-1.5">
              {Array.from({length:12},(_,i)=>i+1).map(m=>(
                <button key={m} onClick={()=>setMonthOfYear(m)}
                  className={`py-1.5 rounded-xl text-xs font-semibold transition-colors ${monthOfYear===m ? 'bg-[var(--color-brand-primary)] text-white' : 'bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]'}`}>
                  {m}월
                </button>
              ))}
            </div>
          </div>
          )}

          {/* 날짜(일) 선택 (매월/매년) */}
          {(repeatType === 'monthly' || repeatType === 'yearly') && (
          <div>
            <p className="text-xs font-semibold text-[var(--color-text-secondary)] mb-2">
              {repeatType === 'monthly' ? '매월 반복 날짜' : '매년 반복 날짜'}
            </p>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({length:31},(_,i)=>i+1).map(d=>(
                <button key={d} onClick={()=>setDayOfMonth(d)}
                  className={`py-1.5 rounded-lg text-xs font-semibold transition-colors ${dayOfMonth===d ? 'bg-[var(--color-brand-primary)] text-white' : 'bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]'}`}>
                  {d}
                </button>
              ))}
            </div>
          </div>
          )}

          {/* 시간대 멀티 선택 */}
          <div>
            <p className="text-xs font-semibold text-[var(--color-text-secondary)] mb-2">
              시간대 <span className="text-red-500">*</span>
            </p>
            <div className="flex flex-wrap gap-1.5">
              {availableSlots.map(slot => {
                const active = selectedSlots.includes(slot)
                return (
                  <button
                    key={slot}
                    onClick={() => toggleSlot(slot)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors border ${
                      active
                        ? 'bg-[var(--color-brand-primary)] text-white border-[var(--color-brand-primary)]'
                        : 'border-[var(--color-border)] text-[var(--color-text-secondary)] bg-[var(--color-surface-secondary)] hover:bg-[var(--color-surface-hover)]'
                    }`}
                  >
                    {slotLabels[slot] || parseSlotLabel(slot)}
                  </button>
                )
              })}
            </div>
          </div>

          {/* 기간 */}
          <div>
            <p className="text-xs font-semibold text-[var(--color-text-secondary)] mb-1.5">기간</p>
            <div className="flex gap-2 mb-2">
              {(repeatType === 'monthly'
                ? (['3months', '6months', '1year', 'custom'] as const)
                : repeatType === 'yearly'
                ? (['1year', '2years', '3years', 'custom'] as const)
                : (['this', 'next', 'custom'] as const)
              ).map(mode => (
                <button key={mode} onClick={() => setRangeMode(mode)} className={tabCls(rangeMode === mode)}>
                  {mode === 'this' ? '이번달'
                    : mode === 'next' ? '다음달'
                    : mode === '3months' ? '3개월'
                    : mode === '6months' ? '6개월'
                    : mode === '1year' ? '1년'
                    : mode === '2years' ? '2년'
                    : mode === '3years' ? '3년'
                    : '직접입력'}
                </button>
              ))}
            </div>
            {rangeMode === 'custom' && (
              <div className="flex gap-2 items-center">
                <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className={inputCls} />
                <span className="text-[var(--color-text-muted)] text-sm shrink-0">~</span>
                <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className={inputCls} />
              </div>
            )}
          </div>

          {/* 이름 */}
          <div className="space-y-3">
            <div>
              <p className="text-xs font-semibold text-[var(--color-text-secondary)] mb-1.5">
                이름 <span className="text-red-500">*</span>
              </p>
              {isFreeform ? (
                isAdmin ? (
                  <input type="text" value={volunteerName} onChange={e => setVolunteerName(e.target.value)} placeholder="이름 입력" className={inputCls} />
                ) : (
                  <input type="text" value={volunteerName} disabled className={`${inputCls} opacity-60 cursor-not-allowed`} />
                )
              ) : isAdmin ? (
                <select
                  value={selectedUserId ?? ''}
                  onChange={e => {
                    const p = profiles.find(p => p.id === e.target.value)
                    setSelectedUserId(e.target.value || null)
                    setVolunteerName(p?.name ?? '')
                    setRoleId(p?.tenantRoleId ?? null)
                  }}
                  className={inputCls}
                >
                  <option value="">회원 선택</option>
                  {profiles.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              ) : (
                <input type="text" value={volunteerName} disabled className={`${inputCls} opacity-60 cursor-not-allowed`} />
              )}
            </div>

            {/* 역할: split 모드에서만 표시, 자동 셋팅 (비활성화) */}
            {isSplitMode && (
              <div>
                <p className="text-xs font-semibold text-[var(--color-text-secondary)] mb-1.5">역할</p>
                <input
                  type="text"
                  value={roleName ?? '미지정'}
                  disabled
                  className={`${inputCls} opacity-60 cursor-not-allowed`}
                />
              </div>
            )}

            <div>
              <p className="text-xs font-semibold text-[var(--color-text-secondary)] mb-1.5">메모</p>
              <textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="메모 (선택)"
                rows={2}
                className={`${inputCls} resize-none`}
              />
            </div>
          </div>

          {/* 미리보기 */}
          {targetPairs.length > 0 ? (
            <div className="bg-[var(--color-surface-secondary)] rounded-xl p-3 space-y-2">
              <p className="text-xs font-semibold text-[var(--color-text-secondary)]">
                등록 예정:{' '}
                <span className="text-[var(--color-brand-primary)] font-bold">{targetPairs.length}건</span>
                {selectedSlots.length > 1 && (
                  <span className="text-[var(--color-text-muted)] ml-1.5">
                    ({uniqueDateKeys.length}일 × {selectedSlots.length}시간대)
                  </span>
                )}
              </p>
              <div className="flex flex-wrap gap-1">
                {previewDates.map(d => (
                  <span
                    key={`${d.year}-${d.month}-${d.day}`}
                    className="text-xs px-2 py-0.5 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-secondary)]"
                  >
                    {d.month}/{d.day}
                  </span>
                ))}
                {uniqueDateKeys.length > 10 && (
                  <span className="text-xs px-2 py-0.5 text-[var(--color-text-muted)]">
                    외 {uniqueDateKeys.length - 10}일
                  </span>
                )}
              </div>
            </div>
          ) : selectedDays.length > 0 && selectedSlots.length > 0 ? (
            <p className="text-xs text-[var(--color-text-muted)] text-center py-2">
              선택한 기간에 해당 요일이 없거나 모두 휴무입니다
            </p>
          ) : null}
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 pt-3 border-t border-[var(--color-border)] shrink-0 space-y-2">
          {error && <p className="text-xs text-red-500 text-center">{error}</p>}
          <button
            onClick={handleSubmit}
            disabled={loading || targetPairs.length === 0 || !volunteerName.trim()}
            className="w-full py-2.5 rounded-xl bg-[var(--color-brand-primary)] text-white text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? '등록 중...' : `${targetPairs.length}건 일괄 등록`}
          </button>
        </div>
      </div>
    </div>
  )
}
