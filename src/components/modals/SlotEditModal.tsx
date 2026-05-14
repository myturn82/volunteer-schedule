import { useState } from 'react'
import type { Assignment, CellState, ModalTarget, Profile, VolunteerType } from '../../types'
import { TYPE_LABELS } from '../../types'
import { useProfiles } from '../../hooks/useProfiles'

interface Props {
  target: ModalTarget
  cellState: CellState
  profile: Profile | null
  onClose: () => void
  onAdd: (name: string, note: string, volunteerType: VolunteerType, timeSub: string | null, color?: string, userId?: string) => Promise<string | null>
  onUpdate: (id: string, name: string, note: string, volunteerType: VolunteerType, timeSub: string | null, color?: string) => Promise<string | null>
  onDelete: (id: string) => Promise<string | null>
}

function getTimeSubOptions(slot: string): { value: string; label: string }[] | null {
  const [start, end] = slot.split('-').map(Number)
  if (end - start !== 2) return null
  return [
    { value: `${start}`, label: `${start}시` },
    { value: `${start + 1}`, label: `${start + 1}시` },
    { value: `${start}~${start + 1}`, label: `${start}~${end}시` },
  ]
}

function formatTimeSub(ts: string | null): string {
  if (!ts) return ''
  if (ts.includes('~')) {
    const [s, e] = ts.split('~').map(Number)
    return `${s}~${e + 1}시`
  }
  return `${ts}시`
}

function getRoleLabel(role: string): string {
  if (role === '50plus') return '50+'
  if (role === 'team_leader') return '팀장'
  return '봉사'
}

export function SlotEditModal({ target, cellState, profile, onClose, onAdd, onUpdate, onDelete }: Props) {
  const { day, month, year, timeSlot, volunteerType: defaultType } = target

  const isAdmin = profile?.role === 'admin' || profile?.role === 'team_leader'
  const isTeamLeader = profile?.role === 'team_leader'
  const profileType: VolunteerType = profile?.role === '50plus' ? '50plus' : 'volunteer'
  const isSaturday = new Date(year, month - 1, day).getDay() === 6

  const [volunteerType, setVolunteerType] = useState<VolunteerType>(
    isAdmin ? defaultType : profileType
  )
  const timeSubOptions = getTimeSubOptions(timeSlot)
  const defaultTimeSub = timeSubOptions ? timeSubOptions[timeSubOptions.length - 1].value : null
  const [timeSub, setTimeSub] = useState<string | null>(defaultTimeSub)
  const [selectedUserId, setSelectedUserId] = useState<string>(isAdmin ? '' : (profile?.id ?? ''))
  const [note, setNote] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const { profiles } = useProfiles()

  const selectedProfile = isAdmin
    ? profiles.find(p => p.id === selectedUserId) ?? null
    : profile

  const effectiveVolunteerType: VolunteerType = isTeamLeader
    ? (selectedProfile?.role === '50plus' ? '50plus' : 'volunteer')
    : volunteerType

  const displayedAssignments = isTeamLeader
    ? cellState.assignments.filter(a => a.volunteer_type === defaultType)
    : cellState.assignments.filter(a => !a.volunteer_type || a.volunteer_type === volunteerType)

  const assignedNames = new Set(
    displayedAssignments.filter(a => a.id !== editingId).map(a => a.volunteer_name)
  )

  const selectableProfiles = isAdmin
    ? isTeamLeader
      ? defaultType === '50plus'
        ? profiles.filter(p => p.role === '50plus' && !assignedNames.has(p.name))
        : profiles.filter(p => (p.role === 'volunteer' || p.role === 'team_leader') && !assignedNames.has(p.name))
      : profiles.filter(p => {
          if (volunteerType === '50plus') return p.role === '50plus' && !assignedNames.has(p.name)
          return (p.role === 'volunteer' || p.role === 'team_leader') && !assignedNames.has(p.name)
        })
    : []

  const totalTypeProfiles = isAdmin
    ? isTeamLeader
      ? defaultType === '50plus'
        ? profiles.filter(p => p.role === '50plus')
        : profiles.filter(p => p.role === 'volunteer' || p.role === 'team_leader')
      : volunteerType === '50plus'
        ? profiles.filter(p => p.role === '50plus')
        : profiles.filter(p => p.role === 'volunteer' || p.role === 'team_leader')
    : []

  function startEdit(a: Assignment) {
    setEditingId(a.id)
    setSelectedUserId(a.user_id)
    setNote(a.note ?? '')
    setVolunteerType(a.volunteer_type ?? 'volunteer')
    setTimeSub(a.time_sub ?? null)
  }

  function cancelEdit() {
    setEditingId(null)
    setSelectedUserId(isAdmin ? '' : (profile?.id ?? ''))
    setNote('')
    setTimeSub(defaultTimeSub)
  }

  async function handleAdd() {
    if (!selectedProfile) return
    if (!isAdmin && cellState.isFull) { setError('정원이 마감되었습니다'); return }
    if (isAdmin && cellState.isFull && !window.confirm(`정원(${cellState.maxCapacity}명)이 초과됩니다. 계속 추가하시겠습니까?`)) return
    setLoading(true)
    const err = await onAdd(
      selectedProfile.name,
      note.trim(),
      effectiveVolunteerType,
      timeSub,
      undefined,
      isAdmin ? selectedProfile.id : undefined
    )
    setLoading(false)
    if (err) setError(err)
    else {
      setSelectedUserId(isAdmin ? '' : (profile?.id ?? ''))
      setNote('')
      setTimeSub(defaultTimeSub)
    }
  }

  async function handleUpdate() {
    if (!editingId || !selectedProfile) return
    setLoading(true)
    const err = await onUpdate(editingId, selectedProfile.name, note.trim(), volunteerType, timeSub, undefined)
    setLoading(false)
    if (err) setError(err)
    else cancelEdit()
  }

  async function handleDelete(id: string) {
    setLoading(true)
    const err = await onDelete(id)
    setLoading(false)
    if (err) setError(err)
  }

  const isAddDisabled = loading || !selectedUserId

  const inputClass = 'w-full border border-[var(--color-border-strong)] rounded-xl px-3 py-2.5 text-sm bg-[var(--color-surface-secondary)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500/60 transition-all duration-200'

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--color-surface)] border border-[var(--color-border-strong)] rounded-2xl shadow-[var(--shadow-xl)] w-full max-w-md animate-scale-in">
        {/* Header */}
        <div className="flex justify-between items-center px-5 pt-5 pb-3 border-b border-[var(--color-border)]">
          <div>
            <h2 className="text-base font-bold text-[var(--color-text-primary)]">
              {month}월 {day}일
            </h2>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              {timeSlot}시 {isTeamLeader ? `· ${defaultType === '50plus' ? '50플러스활동가' : '자원봉사자'}` : '슬롯'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl border border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-secondary)] transition-all duration-200 text-lg leading-none"
          >
            ×
          </button>
        </div>

        {/* Type tabs — 팀장은 숨김 */}
        {!isTeamLeader && (
          <div className="flex border-b border-[var(--color-border)] px-2">
            {(['volunteer', '50plus'] as VolunteerType[]).map(t => {
              const disabledByRole = !isAdmin && profileType !== t
              const isDisabled = disabledByRole
              return (
                <button
                  key={t}
                  onClick={() => {
                    if (!isDisabled) {
                      setVolunteerType(t)
                      setSelectedUserId(isAdmin ? '' : (profile?.id ?? ''))
                    }
                  }}
                  disabled={isDisabled}
                  className={`flex-1 py-2.5 text-xs font-semibold border-b-2 transition-all duration-200
                    ${volunteerType === t
                      ? 'border-[var(--color-brand-primary)] text-[var(--color-brand-primary)]'
                      : 'border-transparent text-[var(--color-text-muted)]'}
                    ${isDisabled ? 'opacity-40 cursor-not-allowed' : 'hover:text-[var(--color-text-secondary)]'}`}
                >
                  {TYPE_LABELS[t]}
                </button>
              )
            })}
          </div>
        )}

        <div className="px-5 py-4 space-y-3">
          {/* Existing assignments */}
          {displayedAssignments.length > 0 && (
            <div className="space-y-1.5">
              {displayedAssignments.map(a => {
                const canEdit = isAdmin || a.user_id === profile?.id
                const isOwnEntry = isTeamLeader && a.user_id === profile?.id && a.volunteer_name === profile?.name
                return (
                  <div
                    key={a.id}
                    className="flex items-center justify-between rounded-xl px-3 py-2 border border-[var(--color-border)]"
                    style={{ backgroundColor: isOwnEntry ? '#FEF9C3' : (a.color || undefined) }}
                  >
                    <span className="text-sm text-[var(--color-text-primary)] font-medium flex items-center flex-wrap gap-1">
                      {a.volunteer_name}
                      {a.time_sub && <span className="text-xs text-[var(--color-text-muted)] font-normal">({formatTimeSub(a.time_sub)})</span>}
                      {a.note && <span className="text-xs text-[var(--color-text-muted)] font-normal">· {a.note}</span>}
                      {isTeamLeader && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${a.volunteer_type === '50plus' ? 'bg-orange-100 text-orange-600' : 'bg-blue-50 text-blue-500'}`}>
                          {a.volunteer_type === '50plus' ? '50+' : '봉사'}
                        </span>
                      )}
                    </span>
                    {canEdit && (
                      <div className="flex gap-2 ml-2 shrink-0">
                        <button onClick={() => startEdit(a)} className="text-xs text-blue-500 hover:text-blue-600 font-medium transition-colors">수정</button>
                        <button onClick={() => handleDelete(a.id)} className="text-xs text-red-400 hover:text-red-500 font-medium transition-colors">삭제</button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {profile ? (
            <>
              {/* Time slot selector */}
              {timeSubOptions && (
                <div>
                  <p className="text-xs font-medium text-[var(--color-text-muted)] mb-2">근무 시간</p>
                  <div className="flex gap-1.5 flex-wrap">
                    {timeSubOptions.map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => setTimeSub(timeSub === opt.value ? null : opt.value)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-200
                          ${timeSub === opt.value
                            ? 'bg-[var(--color-brand-primary)] text-white border-[var(--color-brand-primary)]'
                            : 'border-[var(--color-border-strong)] text-[var(--color-text-secondary)] hover:border-blue-400'}`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Person selector */}
              {isAdmin ? (
                <div className="space-y-2">
                  <div>
                    <p className="text-xs font-medium text-[var(--color-text-muted)] mb-2">봉사자 선택</p>
                    {selectableProfiles.length === 0 ? (
                      <p className="text-xs text-[var(--color-text-muted)] py-2 text-center">
                        {totalTypeProfiles.length === 0
                          ? '해당 유형으로 가입된 회원이 없습니다'
                          : '모든 회원이 이미 배정되어 있습니다'}
                      </p>
                    ) : (
                      <select
                        value={selectedUserId}
                        onChange={e => setSelectedUserId(e.target.value)}
                        className={inputClass}
                      >
                        <option value="">-- 봉사자를 선택하세요 --</option>
                        {selectableProfiles.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.name} [{getRoleLabel(p.role)}]
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
              ) : (
                <div className="px-3 py-2.5 rounded-xl bg-[var(--color-surface-secondary)] border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] font-medium">
                  {profile.name}
                </div>
              )}

              <input
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="메모 (선택)"
                className={inputClass}
              />

              {error && (
                <p className="text-red-500 text-xs bg-red-50 dark:bg-red-950/30 px-3 py-2 rounded-lg border border-red-200 dark:border-red-900/50">
                  {error}
                </p>
              )}

              <div className="flex gap-2">
                <button
                  onClick={editingId ? handleUpdate : handleAdd}
                  disabled={isAddDisabled}
                  className="flex-1 bg-[var(--color-brand-primary)] text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-[var(--color-brand-primary-hover)] disabled:opacity-50 transition-all duration-200 shadow-[0_2px_8px_rgba(37,99,235,0.25)]"
                >
                  {loading ? '저장 중...' : editingId ? '수정 완료' : '추가'}
                </button>
                {editingId ? (
                  <button onClick={cancelEdit} className="flex-1 border border-[var(--color-border-strong)] text-[var(--color-text-secondary)] rounded-xl py-2.5 text-sm font-medium hover:bg-[var(--color-surface-hover)] transition-all duration-200">
                    취소
                  </button>
                ) : (
                  <button onClick={onClose} className="flex-1 border border-[var(--color-border-strong)] text-[var(--color-text-secondary)] rounded-xl py-2.5 text-sm font-medium hover:bg-[var(--color-surface-hover)] transition-all duration-200">
                    닫기
                  </button>
                )}
              </div>
            </>
          ) : (
            <p className="text-sm text-[var(--color-text-muted)] text-center py-3">
              로그인 후 스케줄을 입력할 수 있습니다.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
