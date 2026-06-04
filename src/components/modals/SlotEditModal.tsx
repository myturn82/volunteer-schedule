import { useState, useEffect } from 'react'
import type { Assignment, CellState, ModalTarget, Profile, TenantRole, VolunteerType, CustomFieldDef, TenantMode } from '../../types'
import { parseSlotLabel, getTimeSubOptions, formatTimeSub } from '../../utils/timeSlots'
import { useProfiles } from '../../hooks/useProfiles'
import type { ProfileWithRole } from '../../hooks/useProfiles'

interface Props {
  target: ModalTarget
  cellState: CellState
  profile: Profile | null
  tenantRole?: 'admin' | 'member' | null
  memberRoleId?: string | null
  splitRoles?: TenantRole[]
  isSplitMode?: boolean
  tenantRoles?: TenantRole[]
  tenantMode?: TenantMode | '직접입력' | '회원선택'
  customFields?: CustomFieldDef[]
  slotLabels?: Record<string, string>
  typeLabels?: { volunteer: string; '50plus': string }
  lockedUserId?: string
  onClose: () => void
  onAdd: (name: string, note: string, volunteerType: VolunteerType, timeSub: string | null, color?: string, userId?: string, roleId?: string | null, customerName?: string | null, customerPhone?: string | null, extraData?: Record<string, string>) => Promise<string | null>
  onUpdate: (id: string, name: string, note: string, volunteerType: VolunteerType, timeSub: string | null, color?: string, roleId?: string | null, customerName?: string | null, customerPhone?: string | null, extraData?: Record<string, string>) => Promise<string | null>
  onDelete: (id: string) => Promise<string | null>
}

const PHONE_RE = /^[0-9]{2,4}-[0-9]{3,4}-[0-9]{4}$|^[0-9]{9,11}$/
function isValidPhone(phone: string): boolean {
  return PHONE_RE.test(phone.replace(/\s/g, ''))
}
function formatPhone(value: string): string {
  const d = value.replace(/\D/g, '')
  if (d.startsWith('02')) {
    if (d.length <= 2) return d
    if (d.length <= 5) return `${d.slice(0, 2)}-${d.slice(2)}`
    if (d.length <= 9) return `${d.slice(0, 2)}-${d.slice(2, 5)}-${d.slice(5)}`
    return `${d.slice(0, 2)}-${d.slice(2, 6)}-${d.slice(6, 10)}`
  }
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0, 3)}-${d.slice(3)}`
  if (d.length <= 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7, 11)}`
}

export function SlotEditModal({
  target, cellState, profile, tenantRole, memberRoleId,
  splitRoles = [], isSplitMode = false, tenantRoles = [],
  tenantMode = '회원선택', customFields = [],
  slotLabels = {},
  typeLabels = { volunteer: '팀원', '50plus': '50플러스활동가' },
  lockedUserId,
  onClose, onAdd, onUpdate, onDelete,
}: Props) {
  const { day, month, timeSlot, volunteerType: defaultType, roleId: initialRoleId } = target
  const isAdmin = profile?.is_super_admin || tenantRole === 'admin'
  const isReadOnly = !isAdmin && tenantMode === '회원개별'
  const profileType: VolunteerType = 'volunteer'

  const isFreeform = tenantMode === '비회원' || tenantMode === '직접입력'
  const useDynamicFields = isFreeform && customFields.length > 0

  const [volunteerType, setVolunteerType] = useState<VolunteerType>(
    isAdmin ? defaultType : profileType
  )
  const timeSubOptions = getTimeSubOptions(timeSlot)
  const defaultTimeSub = timeSubOptions ? timeSubOptions[timeSubOptions.length - 1].value : null
  const [timeSub, setTimeSub] = useState<string | null>(defaultTimeSub)
  const [selectedUserId, setSelectedUserId] = useState<string>(
    isAdmin ? (lockedUserId ?? '') : (profile?.id ?? '')
  )
  const [note, setNote] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [phoneError, setPhoneError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(
    initialRoleId ?? (!isAdmin && memberRoleId ? memberRoleId : (splitRoles[0]?.id ?? null))
  )

  // 동적 필드 값 (useDynamicFields 모드)
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({})

  // 레거시 직접입력 필드 (fallback)
  const [freeformName, setFreeformName] = useState('')
  const [freeformPhone, setFreeformPhone] = useState('')

  const selectedRole = splitRoles.find(r => r.id === selectedRoleId) ?? null

  const { profiles } = useProfiles()

  const lockedProfile = lockedUserId ? profiles.find(p => p.id === lockedUserId) ?? null : null
  const selectedProfile = isAdmin
    ? (lockedProfile ?? profiles.find(p => p.id === selectedUserId) ?? null)
    : profile

  const effectiveVolunteerType: VolunteerType = isAdmin
    ? 'volunteer'
    : volunteerType

  const displayedAssignments = isSplitMode
    ? cellState.assignments.filter(a => a.role_id === selectedRoleId)
    : isAdmin
    ? cellState.assignments.filter(a => a.volunteer_type === defaultType)
    : cellState.assignments.filter(a => !a.volunteer_type || a.volunteer_type === volunteerType)

  // DB 제약: (year, month, day, time_slot, volunteer_name) 고유 → 역할 무관하게 같은 슬롯 중복 배정 불가
  const assignedNames = new Set(
    cellState.assignments.filter(a => a.id !== editingId).map(a => a.volunteer_name)
  )

  const selectableProfiles = (!isFreeform && isAdmin)
    ? isSplitMode
      ? (profiles as ProfileWithRole[]).filter(p =>
            p.tenantRoleId === selectedRoleId && !assignedNames.has(p.name)
          )
      : profiles.filter(p => !assignedNames.has(p.name))
    : []

  const totalTypeProfiles = (!isFreeform && isAdmin)
    ? isSplitMode
      ? (profiles as ProfileWithRole[]).filter(p => p.tenantRoleId === selectedRoleId)
      : profiles
    : []

  // 선택 가능한 항목이 1개뿐이면 자동 선택
  const singleProfileId = selectableProfiles.length === 1 ? selectableProfiles[0].id : null
  useEffect(() => {
    if (isAdmin && !editingId && singleProfileId) {
      setSelectedUserId(singleProfileId)
    }
  }, [isAdmin, editingId, singleProfileId])

  function startEdit(a: Assignment) {
    setEditingId(a.id)
    setNote(a.note ?? '')
    setTimeSub(a.time_sub ?? null)
    if (isSplitMode) setSelectedRoleId(a.role_id ?? null)
    if (useDynamicFields) {
      const nameFieldId = customFields[0]?.id
      const restored: Record<string, string> = {}
      if (nameFieldId) restored[nameFieldId] = a.volunteer_name
      Object.assign(restored, a.extra_data ?? {})
      setFieldValues(restored)
    } else if (isFreeform) {
      setFreeformName(a.volunteer_name)
      setFreeformPhone(a.customer_phone ?? '')
    } else {
      setSelectedUserId(a.user_id ?? '')
      setVolunteerType(a.volunteer_type ?? 'volunteer')
    }
  }

  function cancelEdit() {
    setEditingId(null)
    setNote('')
    setTimeSub(defaultTimeSub)
    setFieldValues({})
    setFreeformName('')
    setFreeformPhone('')
    setPhoneError(null)
    setSelectedUserId(isAdmin ? '' : (profile?.id ?? ''))
  }

  async function handleAdd() {
    setError(null)
    let name: string
    let userId: string | undefined
    let customerPhone: string | null = null
    let extraData: Record<string, string> | undefined

    if (useDynamicFields) {
      // 동적 필드 유효성 검사
      for (const field of customFields) {
        if (field.required && !fieldValues[field.id]?.trim()) {
          setError(`"${field.label}"은(는) 필수 항목입니다`)
          return
        }
      }
      const nameFieldId = customFields[0].id
      name = fieldValues[nameFieldId]?.trim() ?? ''
      if (!name) return
      // 첫 번째 필드 제외 나머지 extra_data에 저장
      const rest: Record<string, string> = {}
      customFields.slice(1).forEach(f => {
        if (fieldValues[f.id]?.trim()) rest[f.id] = fieldValues[f.id].trim()
      })
      if (Object.keys(rest).length > 0) extraData = rest
    } else if (isFreeform) {
      if (!freeformName.trim()) return
      if (!freeformPhone.trim()) { setError('연락처를 입력해주세요'); return }
      if (!isValidPhone(freeformPhone.trim())) { setError('연락처 형식이 올바르지 않습니다. (예: 010-1234-5678)'); return }
      name = freeformName.trim()
      customerPhone = freeformPhone.trim()
    } else {
      if (!selectedProfile) return
      name = selectedProfile.name
      userId = isAdmin ? selectedProfile.id : undefined
    }

    if (cellState.isFull) {
      if (!isAdmin && !isFreeform) { setError('정원이 마감되었습니다'); return }
      if (!window.confirm(`정원(${cellState.maxCapacity}명)이 초과됩니다. 계속 추가하시겠습니까?`)) return
    }

    setLoading(true)
    const err = await onAdd(
      name,
      note.trim(),
      isFreeform ? 'volunteer' : effectiveVolunteerType,
      timeSub,
      undefined,
      userId,
      isSplitMode ? selectedRoleId : undefined,
      null,
      customerPhone,
      extraData,
    )
    setLoading(false)
    if (err) { setError(err); return }
    onClose()
  }

  async function handleUpdate() {
    if (!editingId) return
    setError(null)

    let name: string
    let customerPhone: string | null = null
    let extraData: Record<string, string> | undefined

    if (useDynamicFields) {
      for (const field of customFields) {
        if (field.required && !fieldValues[field.id]?.trim()) {
          setError(`"${field.label}"은(는) 필수 항목입니다`)
          return
        }
      }
      const nameFieldId = customFields[0].id
      name = fieldValues[nameFieldId]?.trim() ?? ''
      if (!name) return
      const rest: Record<string, string> = {}
      customFields.slice(1).forEach(f => {
        if (fieldValues[f.id]?.trim()) rest[f.id] = fieldValues[f.id].trim()
      })
      if (Object.keys(rest).length > 0) extraData = rest
    } else if (isFreeform) {
      if (!freeformName.trim()) return
      if (!freeformPhone.trim()) { setError('연락처를 입력해주세요'); return }
      if (!isValidPhone(freeformPhone.trim())) { setError('연락처 형식이 올바르지 않습니다. (예: 010-1234-5678)'); return }
      name = freeformName.trim()
      customerPhone = freeformPhone.trim()
    } else {
      if (!selectedProfile) return
      name = selectedProfile.name
    }

    setLoading(true)
    const err = await onUpdate(
      editingId,
      name,
      note.trim(),
      isFreeform ? 'volunteer' : effectiveVolunteerType,
      timeSub,
      undefined,
      isSplitMode ? selectedRoleId : undefined,
      null,
      customerPhone,
      extraData,
    )
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

  const isAddDisabled = loading || (() => {
    if (useDynamicFields) {
      return customFields.some(f => f.required && !fieldValues[f.id]?.trim())
    }
    if (isFreeform) {
      return !freeformName.trim() || !freeformPhone.trim() || !isValidPhone(freeformPhone.trim())
    }
    return !selectedUserId
  })()

  const inputClass = 'w-full border border-[var(--color-border-strong)] rounded-xl px-3 py-2.5 text-sm bg-[var(--color-surface-secondary)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500/60 transition-all duration-200'

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-hidden">
      <div className="bg-[var(--color-surface)] border border-[var(--color-border-strong)] rounded-2xl shadow-[var(--shadow-xl)] w-full max-w-md animate-scale-in overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)]">
        {/* Header */}
        <div className="flex justify-between items-center px-5 pt-5 pb-3 border-b border-[var(--color-border)] shrink-0">
          <div>
            <h2 className="text-base font-bold text-[var(--color-text-primary)]">
              {month}월 {day}일
            </h2>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              {slotLabels[timeSlot]
                ? `${slotLabels[timeSlot]} (${parseSlotLabel(timeSlot)})`
                : parseSlotLabel(timeSlot)}
              {isSplitMode && selectedRole ? ` · ${selectedRole.name}` : !isSplitMode && isAdmin && !isFreeform && tenantRoles.length === 0 ? ` · ${defaultType === '50plus' ? typeLabels['50plus'] : typeLabels.volunteer}` : ''}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl border border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-secondary)] transition-all duration-200 text-lg leading-none"
          >
            ×
          </button>
        </div>

        {/* Role selector (split mode) OR type tabs (회원선택 모드) */}
        {isSplitMode ? (
          isAdmin && splitRoles.length > 1 ? (
            <div className="flex border-b border-[var(--color-border)] px-4 py-2 gap-2 items-center shrink-0">
              <p className="text-xs font-medium text-[var(--color-text-muted)] shrink-0">역할</p>
              <select
                value={selectedRoleId ?? ''}
                onChange={e => {
                  setSelectedRoleId(e.target.value || null)
                  setFieldValues({})
                  setFreeformName('')
                  setFreeformPhone('')
                  setSelectedUserId('')
                }}
                className={inputClass}
              >
                {splitRoles.map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
          ) : !isAdmin && selectedRole ? (
            <div className="flex border-b border-[var(--color-border)] px-4 py-2 gap-2 items-center shrink-0">
              <p className="text-xs font-medium text-[var(--color-text-muted)] shrink-0">역할</p>
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">{selectedRole.name}</p>
            </div>
          ) : null
        ) : !isAdmin && !isFreeform && tenantRoles.length === 0 && (  // 커스텀 역할 없는 조직만 표시
          <div className="flex border-b border-[var(--color-border)] px-2 shrink-0">
            {(['volunteer', '50plus'] as VolunteerType[]).map(t => {
              const isDisabled = !isAdmin && profileType !== t
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
                  {t === '50plus' ? typeLabels['50plus'] : typeLabels.volunteer}
                </button>
              )
            })}
          </div>
        )}

        <div className="px-5 py-4 space-y-3 overflow-y-auto flex-1">
          {/* Existing assignments */}
          {displayedAssignments.length > 0 && (
            <div className="space-y-1.5">
              {displayedAssignments.map(a => {
                const canEdit = isAdmin || (a.user_id === profile?.id && !isReadOnly)
                const isOwnEntry = !isAdmin && a.user_id === profile?.id && a.volunteer_name === profile?.name
                return (
                  <div
                    key={a.id}
                    className="rounded-xl px-3 py-2.5 border border-[var(--color-border)]"
                    style={{ backgroundColor: isOwnEntry ? '#FEF9C3' : (a.color || undefined) }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <span className="text-sm text-[var(--color-text-primary)] font-medium flex items-center flex-wrap gap-1">
                          {isFreeform && useDynamicFields && customFields[0]
                            ? `${customFields[0].label}: ${a.volunteer_name}`
                            : a.volunteer_name}
                          {a.time_sub && <span className="text-xs text-[var(--color-text-muted)] font-normal">({formatTimeSub(a.time_sub)})</span>}
                          {!isFreeform && isAdmin && !isSplitMode && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${a.volunteer_type === '50plus' ? 'bg-orange-100 text-orange-600' : 'bg-blue-50 text-blue-500'}`}>
                              {a.volunteer_type === '50plus' ? '50+' : '봉사'}
                            </span>
                          )}
                        </span>
                        {isFreeform ? (
                          <div className="flex flex-col gap-0.5 mt-0.5">
                            {!useDynamicFields && a.customer_phone && (
                              <span className="text-xs text-[var(--color-text-muted)]">연락처: {a.customer_phone}</span>
                            )}
                            {useDynamicFields && customFields.slice(1).map(f =>
                              a.extra_data?.[f.id] ? (
                                <span key={f.id} className="text-xs text-[var(--color-text-muted)]">{f.label}: {a.extra_data[f.id]}</span>
                              ) : null
                            )}
                            {a.note && <span className="text-xs text-[var(--color-text-muted)]">메모: {a.note}</span>}
                          </div>
                        ) : (
                          a.note && <span className="text-xs text-[var(--color-text-muted)] mt-0.5">메모: {a.note}</span>
                        )}
                      </div>
                      {canEdit && (
                        <div className="flex gap-2 shrink-0">
                          <button onClick={() => startEdit(a)} className="text-xs text-blue-500 hover:text-blue-600 font-medium transition-colors">수정</button>
                          <button onClick={() => handleDelete(a.id)} className="text-xs text-red-400 hover:text-red-500 font-medium transition-colors">삭제</button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {profile && !isReadOnly ? (
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

              {/* Input section */}
              {useDynamicFields ? (
                /* 동적 커스텀 필드 */
                <>
                  {customFields.map(field => (
                    <div key={field.id}>
                      <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">
                        {field.label}{field.required && <span className="text-red-500 ml-0.5">*</span>}
                      </label>
                      {field.type === 'select' && (field.options?.length ?? 0) > 0 ? (
                        <select
                          value={fieldValues[field.id] ?? ''}
                          onChange={e => setFieldValues(prev => ({ ...prev, [field.id]: e.target.value }))}
                          className={inputClass}
                        >
                          <option value="">{field.placeholder || `-- ${field.label} 선택 --`}</option>
                          {field.options!.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.name}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={fieldValues[field.id] ?? ''}
                          onChange={e => setFieldValues(prev => ({ ...prev, [field.id]: e.target.value }))}
                          placeholder={field.placeholder || `${field.label}${field.required ? ' (필수)' : ' (선택)'}`}
                          maxLength={100}
                          className={inputClass}
                        />
                      )}
                    </div>
                  ))}
                  <input
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    placeholder="메모 (선택)"
                    maxLength={200}
                    className={inputClass}
                  />
                </>
              ) : isFreeform ? (
                /* 레거시 직접입력 모드 (이름 + 연락처) */
                <>
                  <input
                    value={freeformName}
                    onChange={e => setFreeformName(e.target.value)}
                    placeholder="이름 (필수)"
                    maxLength={50}
                    className={inputClass}
                  />
                  <input
                    value={freeformPhone}
                    onChange={e => {
                      const formatted = formatPhone(e.target.value)
                      setFreeformPhone(formatted)
                      if (!formatted) setPhoneError(null)
                      else if (!isValidPhone(formatted)) setPhoneError('연락처 형식이 올바르지 않습니다. (예: 010-1234-5678)')
                      else setPhoneError(null)
                    }}
                    placeholder="연락처 (필수)"
                    maxLength={20}
                    className={inputClass}
                  />
                  {phoneError && (
                    <p className="text-red-500 text-xs px-1">{phoneError}</p>
                  )}
                  <input
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    placeholder="메모 (선택)"
                    maxLength={200}
                    className={inputClass}
                  />
                </>
              ) : (
                /* 회원선택 모드 */
                <>
                  {isAdmin ? (
                    <div>
                      <p className="text-xs font-medium text-[var(--color-text-muted)] mb-2">회원 선택</p>
                      {lockedUserId ? (
                        <div className="px-3 py-2.5 rounded-xl bg-[var(--color-surface-secondary)] border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] font-medium">
                          {profiles.find(p => p.id === lockedUserId)?.name ?? '알 수 없음'}
                        </div>
                      ) : selectableProfiles.length === 0 ? (
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
                          <option value="">-- 회원을 선택하세요 --</option>
                          {selectableProfiles.map(p => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      )}
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
                </>
              )}

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
                  {loading ? '저장 중...' : editingId ? '수정 완료' : '저장'}
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
          ) : profile && isReadOnly ? (
            <p className="text-sm text-[var(--color-text-muted)] text-center py-3">
              스케줄 조회 전용입니다. 배정은 관리자에게 문의하세요.
            </p>
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
