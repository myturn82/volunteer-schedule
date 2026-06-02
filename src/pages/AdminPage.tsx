import { useState, useEffect, useMemo, Fragment } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useAdmin } from '../hooks/useAdmin'
import { useTenant } from '../contexts/TenantContext'
import { useTenantRoles } from '../hooks/useTenantRoles'
import { supabase } from '../lib/supabase'
import { buildSlot, parseSlotLabel, generateTimeSlots, DEFAULT_TIME_SLOTS, SLOT_TEMPLATES } from '../utils/timeSlots'
import type { TimeSlot, Tenant, TenantAccessRole, LegendItem, LegendColor, CustomFieldDef, CustomFieldOption } from '../types'
import { LEGEND_COLOR_STYLES } from '../components/schedule/Legend'

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']
const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/

function makeTimeOpt(halfHours: number) {
  const h = Math.floor(halfHours / 2)
  const m = halfHours % 2 === 0 ? '00' : '30'
  return { value: halfHours / 2, label: `${h}:${m}` }
}
const START_OPTIONS = Array.from({ length: 48 }, (_, i) => makeTimeOpt(i))
const END_OPTIONS   = Array.from({ length: 48 }, (_, i) => makeTimeOpt(i + 1))

type Tab = 'members' | 'pending' | 'roles' | 'rules' | 'dates' | 'settings' | 'legend' | 'custom_fields'

const TAB_LABELS: Record<Tab, string> = {
  members: '회원 관리',
  pending: '승인 대기',
  roles: '역할 관리',
  rules: '스케줄 규칙',
  dates: '날짜 설정',
  settings: '조직 설정',
  legend: '범례 관리',
  custom_fields: '입력 필드',
}

export function AdminPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const initOrgId = searchParams.get('org')

  const { profile, loading: authLoading } = useAuth()
  const { tenant, memberships, updateCurrentTenant } = useTenant()

  // Local org selection — independent from TenantContext (doesn't affect schedule page)
  const [adminTenant, setAdminTenant] = useState<Tenant | null>(null)
  const [availableTenants, setAvailableTenants] = useState<Tenant[]>([])
  const [orgLoading, setOrgLoading] = useState(true)

  const adminTenantId = adminTenant?.id ?? ''

  const {
    members, scheduleRules, dateOverrides, loading,
    reloadMembers,
    addMember, removeMember, updateMemberTenantRole, updateMemberAccess,
    toggleScheduleRule, upsertScheduleRulesForSlots,
    addDateOverride, deleteDateOverride,
    updateTenantSettings, updateTenantName, approveUser,
    approveWithdrawal, rejectWithdrawal,
  } = useAdmin(adminTenantId)
  const { roles, addRole, deleteRole, updateRole, moveRole } = useTenantRoles(adminTenantId)

  const initTab = searchParams.get('tab') as Tab | null
  const [tab, setTab] = useState<Tab>(
    initTab && (Object.keys(TAB_LABELS) as Tab[]).includes(initTab) ? initTab : 'members'
  )
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null)
  const [saving, setSaving] = useState(false)

  // Members tab
  const [showAddMember, setShowAddMember] = useState(false)
  const [addEmail, setAddEmail] = useState('')

  // 회원 선호 설정 (자동배정)
  const [expandedPrefUserId, setExpandedPrefUserId] = useState<string | null>(null)
  const [prefDays, setPrefDays] = useState<number[]>([])
  const [prefLimit, setPrefLimit] = useState<string>('')

  // 직접 등록 (이메일 인증 없이 테스트 계정 생성)
  const [showDirectCreate, setShowDirectCreate] = useState(false)
  const [directForm, setDirectForm] = useState({ email: '', name: '', password: '', roleId: '' })
  const [directSaving, setDirectSaving] = useState(false)

  // Roles tab
  const [newRoleName, setNewRoleName] = useState('')
  const [newRoleSplitCell, setNewRoleSplitCell] = useState(false)
  const [newRoleIndicatorBar, setNewRoleIndicatorBar] = useState(false)
  const [newRoleRequiresCustomerInfo, setNewRoleRequiresCustomerInfo] = useState(false)
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null)
  const [editRoleName, setEditRoleName] = useState('')

  // Dates tab
  const [dateForm, setDateForm] = useState({ date: '', type: 'holiday' as 'holiday' | 'special', label: '' })

  // Settings tab — derived from adminTenant
  const [slotList, setSlotList] = useState<string[]>([])
  const [slotStart, setSlotStart] = useState(10)
  const [slotEnd, setSlotEnd] = useState(12)
  const [settingsName, setSettingsName] = useState('')
  const [settingsTitle, setSettingsTitle] = useState('')
  const [settingsTheme, setSettingsTheme] = useState('')
  const [settingsVolunteerLabel, setSettingsVolunteerLabel] = useState('')
  const [settingsPlusLabel, setSettingsPlusLabel] = useState('')
  const [slotLabels, setSlotLabels] = useState<Record<string, string>>({})
  const [roleRatios, setRoleRatios] = useState<Record<string, number>>({})
  const [ratioSaving, setRatioSaving] = useState(false)
  const [legendItems, setLegendItems] = useState<LegendItem[]>([])
  const [newLegendIcon, setNewLegendIcon] = useState('')
  const [newLegendLabel, setNewLegendLabel] = useState('')
  const [newLegendColor, setNewLegendColor] = useState<LegendColor>('blue')
  const [editingLegendId, setEditingLegendId] = useState<string | null>(null)
  const [editLegendIcon, setEditLegendIcon] = useState('')
  const [editLegendLabel, setEditLegendLabel] = useState('')
  const [editLegendColor, setEditLegendColor] = useState<LegendColor>('blue')

  // Custom fields tab
  const [customFields, setCustomFields] = useState<CustomFieldDef[]>([])
  const [newFieldLabel, setNewFieldLabel] = useState('')
  const [newFieldType, setNewFieldType] = useState<'text' | 'select'>('text')
  const [newFieldRequired, setNewFieldRequired] = useState(true)
  const [newFieldOptions, setNewFieldOptions] = useState<CustomFieldOption[]>([])
  const [newFieldShowInDashboard, setNewFieldShowInDashboard] = useState(false)
  const [newFieldPlaceholder, setNewFieldPlaceholder] = useState('')
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null)
  const [editField, setEditField] = useState<Omit<CustomFieldDef, 'id'>>({ label: '', type: 'text', required: true, options: [], placeholder: '', show_in_dashboard: false })

  // Sync settings form when adminTenant changes
  useEffect(() => {
    if (!adminTenant) return
    const s = adminTenant.settings
    setSlotList(s.time_slots?.length ? s.time_slots : [])
    setSettingsName(adminTenant.name)
    setSettingsTitle(s.title ?? '')
    setSettingsTheme(s.theme_color ?? '')
    setSettingsVolunteerLabel(s.volunteer_label ?? '')
    setSettingsPlusLabel(s.plus_label ?? '')
    setSlotLabels(s.slot_labels ?? {})
    setRoleRatios(s.role_ratios ?? {})
    setLegendItems(s.legend_items ?? [])
    setCustomFields(s.custom_fields ?? [])
  }, [adminTenant?.id])

  // Load available orgs based on user role
  useEffect(() => {
    if (!profile || authLoading) return
    const currentProfile = profile
    async function loadOrgs() {
      let orgs: Tenant[]
      if (currentProfile.is_super_admin) {
        const { data } = await supabase.from('tenants').select('*').order('name')
        orgs = (data ?? []) as Tenant[]
      } else {
        orgs = memberships
          .filter(m => m.role === 'admin')
          .map(m => (m as { tenant: Tenant }).tenant)
      }
      setAvailableTenants(orgs)
      const init =
        orgs.find(t => t.id === initOrgId) ??
        orgs.find(t => t.id === tenant?.id) ??
        orgs[0] ??
        null
      setAdminTenant(init)
      setOrgLoading(false)
    }
    loadOrgs()
  }, [profile?.id, authLoading])

  // timeSlots derived from adminTenant (not from TenantContext)
  const adminTimeSlots = useMemo<TimeSlot[]>(() => {
    const s = adminTenant?.settings
    if (!s) return DEFAULT_TIME_SLOTS
    return s.time_slots?.length
      ? s.time_slots
      : generateTimeSlots(s.open_from, s.open_to, s.slot_interval_minutes)
  }, [adminTenant?.id, adminTenant?.settings])

  if (authLoading || orgLoading) {
    return <div className="min-h-screen flex items-center justify-center text-[var(--color-text-muted)]">로딩 중...</div>
  }

  // Access control: super admin, current tenant admin, or admin of any org
  const canAdmin =
    profile?.is_super_admin ||
    memberships.some(m => m.role === 'admin')

  if (!profile || !canAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg)]">
        <div className="text-center">
          <p className="text-[var(--color-text-muted)] mb-4">관리자 권한이 필요합니다.</p>
          <button onClick={() => navigate('/')} className="text-[var(--color-brand-primary)] hover:underline text-sm">← 메인으로 돌아가기</button>
        </div>
      </div>
    )
  }

  function getRule(dayOfWeek: number, slot: TimeSlot) {
    return scheduleRules.find(r => r.day_of_week === dayOfWeek && r.time_slot === slot)
  }

  function msg(text: string, isError = false) { setMessage({ text, isError }) }

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const err = await addMember(addEmail.trim())
    setSaving(false)
    if (err) { msg(err, true); return }
    msg(`${addEmail} 회원이 추가됐습니다.`)
    setAddEmail('')
    setShowAddMember(false)
  }

  async function addLegendItem() {
    if (!newLegendIcon.trim() || !newLegendLabel.trim() || !adminTenantId) return
    const newItem: LegendItem = {
      id: Date.now().toString(),
      icon: newLegendIcon.trim(),
      label: newLegendLabel.trim(),
      color: newLegendColor,
    }
    const next = [...legendItems, newItem]
    const err = await updateTenantSettings(adminTenantId, { legend_items: next })
    if (err) { msg(err, true); return }
    setLegendItems(next)
    if (adminTenant) {
      const updated = { ...adminTenant, settings: { ...adminTenant.settings, legend_items: next } }
      setAdminTenant(updated)
      if (adminTenant.id === tenant?.id) updateCurrentTenant(updated)
    }
    setNewLegendIcon('')
    setNewLegendLabel('')
    msg('항목이 추가됐습니다.')
  }

  async function removeLegendItem(id: string) {
    if (!adminTenantId) return
    const next = legendItems.filter(i => i.id !== id)
    const err = await updateTenantSettings(adminTenantId, { legend_items: next })
    if (err) { msg(err, true); return }
    setLegendItems(next)
    if (adminTenant) {
      const updated = { ...adminTenant, settings: { ...adminTenant.settings, legend_items: next } }
      setAdminTenant(updated)
      if (adminTenant.id === tenant?.id) updateCurrentTenant(updated)
    }
  }

  function startEditLegend(item: LegendItem) {
    setEditingLegendId(item.id)
    setEditLegendIcon(item.icon)
    setEditLegendLabel(item.label)
    setEditLegendColor(item.color)
  }

  async function saveLegendEdit() {
    if (!editingLegendId || !editLegendIcon.trim() || !editLegendLabel.trim() || !adminTenantId) return
    const next = legendItems.map(i =>
      i.id === editingLegendId
        ? { ...i, icon: editLegendIcon.trim(), label: editLegendLabel.trim(), color: editLegendColor }
        : i
    )
    const err = await updateTenantSettings(adminTenantId, { legend_items: next })
    if (err) { msg(err, true); return }
    setLegendItems(next)
    if (adminTenant) {
      const updated = { ...adminTenant, settings: { ...adminTenant.settings, legend_items: next } }
      setAdminTenant(updated)
      if (adminTenant.id === tenant?.id) updateCurrentTenant(updated)
    }
    setEditingLegendId(null)
    msg('수정됐습니다.')
  }

  // ── 커스텀 필드 CRUD ──────────────────────────────────────────────────────────

  async function addCustomField(e: React.FormEvent) {
    e.preventDefault()
    if (!newFieldLabel.trim() || !adminTenantId) return
    const newField: CustomFieldDef = {
      id: Date.now().toString(),
      label: newFieldLabel.trim(),
      type: newFieldType,
      required: newFieldRequired,
      options: newFieldType === 'select' ? newFieldOptions.filter(o => o.name.trim() || o.value.trim()) : undefined,
      placeholder: newFieldPlaceholder.trim() || undefined,
      show_in_dashboard: newFieldType === 'select' && newFieldShowInDashboard ? true : undefined,
    }
    const next = [...customFields, newField]
    const err = await updateTenantSettings(adminTenantId, { custom_fields: next })
    if (err) { msg(err, true); return }
    setCustomFields(next)
    if (adminTenant) {
      const updated = { ...adminTenant, settings: { ...adminTenant.settings, custom_fields: next } }
      setAdminTenant(updated)
      if (adminTenant.id === tenant?.id) updateCurrentTenant(updated)
    }
    setNewFieldLabel('')
    setNewFieldType('text')
    setNewFieldRequired(true)
    setNewFieldOptions([])
    setNewFieldShowInDashboard(false)
    setNewFieldPlaceholder('')
    msg('필드가 추가됐습니다.')
  }

  async function removeCustomField(id: string) {
    if (!adminTenantId) return
    const next = customFields.filter(f => f.id !== id)
    const err = await updateTenantSettings(adminTenantId, { custom_fields: next })
    if (err) { msg(err, true); return }
    setCustomFields(next)
    if (adminTenant) {
      const updated = { ...adminTenant, settings: { ...adminTenant.settings, custom_fields: next } }
      setAdminTenant(updated)
      if (adminTenant.id === tenant?.id) updateCurrentTenant(updated)
    }
  }

  async function saveFieldEdit() {
    if (!editingFieldId || !editField.label.trim() || !adminTenantId) return
    const next = customFields.map(f =>
      f.id === editingFieldId
        ? {
            ...f,
            label: editField.label.trim(),
            type: editField.type,
            required: editField.required,
            options: editField.type === 'select' ? (editField.options ?? []).filter(o => o.name.trim() || o.value.trim()) : undefined,
            placeholder: editField.placeholder?.trim() || undefined,
            show_in_dashboard: editField.type === 'select' && editField.show_in_dashboard ? true : undefined,
          }
        : f
    )
    const err = await updateTenantSettings(adminTenantId, { custom_fields: next })
    if (err) { msg(err, true); return }
    setCustomFields(next)
    if (adminTenant) {
      const updated = { ...adminTenant, settings: { ...adminTenant.settings, custom_fields: next } }
      setAdminTenant(updated)
      if (adminTenant.id === tenant?.id) updateCurrentTenant(updated)
    }
    setEditingFieldId(null)
    msg('수정됐습니다.')
  }

  function moveField(id: string, dir: -1 | 1) {
    const idx = customFields.findIndex(f => f.id === id)
    if (idx < 0) return
    const next = [...customFields]
    const target = idx + dir
    if (target < 0 || target >= next.length) return
    ;[next[idx], next[target]] = [next[target], next[idx]]
    setCustomFields(next)
    if (adminTenantId) {
      updateTenantSettings(adminTenantId, { custom_fields: next }).then(err => {
        if (err) msg(err, true)
        else if (adminTenant) {
          const updated = { ...adminTenant, settings: { ...adminTenant.settings, custom_fields: next } }
          setAdminTenant(updated)
          if (adminTenant.id === tenant?.id) updateCurrentTenant(updated)
        }
      })
    }
  }

  function moveLegendItem(id: string, dir: -1 | 1) {
    const idx = legendItems.findIndex(i => i.id === id)
    const target = idx + dir
    if (idx < 0 || target < 0 || target >= legendItems.length) return
    const next = [...legendItems]
    ;[next[idx], next[target]] = [next[target], next[idx]]
    setLegendItems(next)
    if (adminTenantId) {
      updateTenantSettings(adminTenantId, { legend_items: next }).then(err => {
        if (err) msg(err, true)
        else if (adminTenant) {
          const updated = { ...adminTenant, settings: { ...adminTenant.settings, legend_items: next } }
          setAdminTenant(updated)
          if (adminTenant.id === tenant?.id) updateCurrentTenant(updated)
        }
      })
    }
  }

  async function handleDirectCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!adminTenantId) return
    setDirectSaving(true)
    const { data, error } = await supabase.functions.invoke('admin-create-user', {
      body: {
        email: directForm.email,
        password: directForm.password,
        name: directForm.name,
        role_id: directForm.roleId || null,
        tenant_id: adminTenantId,
      },
    })
    setDirectSaving(false)
    if (error || data?.error) {
      msg(data?.error ?? error?.message ?? '오류가 발생했습니다.', true)
      return
    }
    await reloadMembers()
    msg(`${directForm.name} (${directForm.email}) 계정이 생성되고 조직에 추가됐습니다.`)
    setDirectForm({ email: '', name: '', password: '', roleId: '' })
    setShowDirectCreate(false)
  }

  async function saveMemberPreference(
    userId: string,
    availableDays: number[] | null,
    monthlyLimit: number | null
  ): Promise<string | null> {
    const { error } = await supabase
      .from('tenant_members')
      .update({ available_days: availableDays, monthly_limit: monthlyLimit })
      .eq('tenant_id', adminTenantId)
      .eq('user_id', userId)
    if (!error) {
      await reloadMembers()
    }
    return error?.message ?? null
  }

  async function handleAddRole(e: React.FormEvent) {
    e.preventDefault()
    const trimmedName = newRoleName.trim()
    if (!trimmedName) return
    if (roles.some(r => r.name === trimmedName)) {
      msg('같은 이름의 역할이 이미 존재합니다.', true)
      return
    }
    const err = await addRole(trimmedName, newRoleSplitCell, newRoleRequiresCustomerInfo, newRoleIndicatorBar)
    if (err) { msg(err, true); return }
    setNewRoleName('')
    setNewRoleSplitCell(false)
    setNewRoleIndicatorBar(false)
    setNewRoleRequiresCustomerInfo(false)
  }

  async function handleDateSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!dateForm.date) { msg('날짜를 선택해주세요.', true); return }
    const existingOverride = dateOverrides.find(d => d.date === dateForm.date)
    if (existingOverride) {
      msg(`${dateForm.date}는 이미 ${existingOverride.is_holiday ? '휴관일' : '특별운영일'}로 등록되어 있습니다. 삭제 후 다시 추가해주세요.`, true)
      return
    }
    setSaving(true)
    const isHoliday = dateForm.type === 'holiday'
    const err = await addDateOverride(dateForm.date, !isHoliday, isHoliday, dateForm.label || null)
    setSaving(false)
    if (err) { msg(err, true); return }
    msg('저장되었습니다.')
    setDateForm({ date: '', type: 'holiday', label: '' })
  }

  async function handleAddSlot() {
    if (slotEnd <= slotStart) { msg('종료 시간은 시작 시간보다 커야 합니다.', true); return }
    const slot = buildSlot(slotStart, slotEnd)
    if (slotList.includes(slot)) { msg('이미 등록된 슬롯입니다.', true); return }
    const newList = [...slotList, slot].sort((a, b) => parseFloat(a) - parseFloat(b))
    setSlotList(newList)
    const err = await upsertScheduleRulesForSlots([slot])
    if (err) msg(`슬롯이 추가됐으나 규칙 생성에 실패했습니다: ${err}`, true)
  }

  async function handleRatioSave() {
    const total = Object.values(roleRatios).reduce((s, v) => s + v, 0)
    if (Object.keys(roleRatios).length > 0 && total !== 100) {
      msg('역할 비율의 합계는 100%이어야 합니다.', true)
      return
    }
    setRatioSaving(true)
    const currentSettings = adminTenant?.settings ?? {}
    const merged = { ...currentSettings, role_ratios: roleRatios }
    const { error } = await supabase
      .from('tenants')
      .update({ settings: merged })
      .eq('id', adminTenantId)
    if (!error) msg('역할 비율이 저장됐습니다.')
    else msg(`오류: ${error.message}`, true)
    setRatioSaving(false)
  }

  async function handleSettingsSave(e: React.FormEvent) {
    e.preventDefault()
    if (!adminTenant) return
    if (slotList.length === 0) { msg('슬롯을 하나 이상 등록해야 합니다.', true); return }
    if (settingsTheme && !HEX_COLOR_RE.test(settingsTheme.trim())) {
      msg('테마 색상은 #RRGGBB 형식으로 입력해주세요. (예: #2563eb)', true)
      return
    }
    setSaving(true)
    const hasHalf = slotList.some(s => s.includes('.'))
    const [nameErr, settingsErr, rulesErr] = await Promise.all([
      updateTenantName(adminTenant.id, settingsName.trim()),
      updateTenantSettings(adminTenant.id, {
        title: settingsTitle.trim(),
        theme_color: settingsTheme.trim() || undefined,
        volunteer_label: settingsVolunteerLabel.trim() || undefined,
        plus_label: settingsPlusLabel.trim() || undefined,
        time_slots: slotList,
        slot_interval_minutes: hasHalf ? 30 : 60,
        slot_labels: slotLabels,
      }),
      upsertScheduleRulesForSlots(slotList),
    ])
    setSaving(false)
    const err = nameErr || settingsErr || rulesErr
    msg(err ?? '저장됐습니다.', !!err)
    if (!err) {
      const updated = {
        ...adminTenant,
        name: settingsName.trim(),
        settings: {
          ...adminTenant.settings,
          title: settingsTitle.trim(),
          time_slots: slotList,
          theme_color: settingsTheme.trim() || undefined,
          volunteer_label: settingsVolunteerLabel.trim() || undefined,
          plus_label: settingsPlusLabel.trim() || undefined,
          slot_interval_minutes: hasHalf ? 30 : 60,
          slot_labels: slotLabels,
          legend_items: legendItems,
        },
      }
      setAdminTenant(updated)
      if (adminTenant.id === tenant?.id) updateCurrentTenant(updated)
    }
  }

  const inputCls = 'border border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-text-primary)] rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-primary)]/30 focus:border-[var(--color-brand-primary)]'

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      {/* Sticky header */}
      <div className="bg-[var(--color-surface)] shadow-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3 flex-wrap">
            <button onClick={() => navigate('/')} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] text-sm shrink-0">← 뒤로</button>
            <h1 className="text-base font-bold text-[var(--color-text-primary)] shrink-0">관리자 대시보드</h1>
            {/* Org selector */}
            {availableTenants.length > 1 ? (
              <select
                value={adminTenant?.id ?? ''}
                onChange={e => {
                  const t = availableTenants.find(t => t.id === e.target.value)
                  if (t) setAdminTenant(t)
                }}
                className="text-sm border border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-text-primary)] rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-primary)]/30"
              >
                {availableTenants.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            ) : (
              <span className="text-sm text-[var(--color-text-muted)]">· {adminTenant?.name}</span>
            )}
          </div>
          <span className="text-sm text-[var(--color-text-muted)]">{profile.name}</span>
        </div>
        <div className="max-w-5xl mx-auto px-4 border-t border-[var(--color-border)] flex overflow-x-auto whitespace-nowrap [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
          {(Object.keys(TAB_LABELS) as Tab[]).map(t => {
            const pendingCount = t === 'pending'
              ? members.filter(m => !m.is_approved).length
              : 0
            return (
              <button key={t} onClick={() => setTab(t)}
                className={`shrink-0 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px flex items-center gap-1.5 ${
                  tab === t ? 'border-[var(--color-brand-primary)] text-[var(--color-brand-primary)]' : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
                }`}>
                {TAB_LABELS[t]}
                {pendingCount > 0 && (
                  <span className="inline-flex items-center justify-center w-4 h-4 text-[9px] font-bold rounded-full bg-red-500 text-white">
                    {pendingCount}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {message && (
          <div className={`mb-4 p-3 rounded-lg text-sm flex justify-between items-center ${
            message.isError ? 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300' : 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300'
          }`}>
            <span>{message.text}</span>
            <button onClick={() => setMessage(null)} className="ml-2 opacity-60 hover:opacity-100">✕</button>
          </div>
        )}

        {!adminTenant ? (
          <div className="text-center py-16 text-[var(--color-text-muted)]">관리할 조직을 선택해 주세요.</div>
        ) : loading ? (
          <div className="text-center py-16 text-[var(--color-text-muted)]">로딩 중...</div>
        ) : (
          <>
            {/* ── 회원 관리 ── */}
            {tab === 'members' && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider font-semibold">회원 ({members.filter(m => m.is_approved).length}명)</p>
                    {(() => { const n = members.filter(m => !m.is_approved).length; return n > 0 ? (
                      <button onClick={() => setTab('pending')} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors">
                        승인대기 {n}건 →
                      </button>
                    ) : null })()}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setShowDirectCreate(v => !v); setShowAddMember(false) }}
                      className="px-3 py-1.5 text-xs font-medium border border-orange-400 text-orange-600 rounded-lg hover:bg-orange-50"
                    >
                      + 직접 등록
                    </button>
                    <button
                      onClick={() => { setShowAddMember(v => !v); setShowDirectCreate(false) }}
                      className="px-3 py-1.5 text-xs font-medium bg-[var(--color-brand-primary)] text-white rounded-lg hover:bg-[var(--color-brand-primary-hover)]"
                    >
                      + 회원 추가
                    </button>
                  </div>
                </div>

                {showDirectCreate && (
                  <form onSubmit={handleDirectCreate} className="mb-4 p-4 bg-[var(--color-surface)] rounded-xl shadow space-y-3">
                    <p className="text-xs font-semibold text-orange-600">
                      직접 등록 — 이메일 인증 없이 계정을 생성하고 이 조직에 자동으로 추가합니다
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-[var(--color-text-muted)] mb-1">이름 *</label>
                        <input type="text" required value={directForm.name}
                          onChange={e => setDirectForm(p => ({ ...p, name: e.target.value }))}
                          placeholder="홍길동" className={inputCls + ' w-full'} />
                      </div>
                      <div>
                        <label className="block text-xs text-[var(--color-text-muted)] mb-1">이메일 *</label>
                        <input type="email" required value={directForm.email}
                          onChange={e => setDirectForm(p => ({ ...p, email: e.target.value }))}
                          placeholder="test@example.com" className={inputCls + ' w-full'} />
                      </div>
                      <div>
                        <label className="block text-xs text-[var(--color-text-muted)] mb-1">비밀번호 * (6자 이상)</label>
                        <input type="password" required minLength={6} value={directForm.password}
                          onChange={e => setDirectForm(p => ({ ...p, password: e.target.value }))}
                          placeholder="••••••" className={inputCls + ' w-full'} />
                      </div>
                      <div>
                        <label className="block text-xs text-[var(--color-text-muted)] mb-1">역할</label>
                        <select value={directForm.roleId}
                          onChange={e => setDirectForm(p => ({ ...p, roleId: e.target.value }))}
                          className={inputCls + ' w-full'}>
                          <option value="">미지정</option>
                          {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button type="submit" disabled={directSaving}
                        className="px-4 py-1.5 bg-orange-500 text-white text-sm rounded-lg hover:bg-orange-600 disabled:opacity-50">
                        {directSaving ? '생성 중...' : '계정 생성'}
                      </button>
                      <button type="button" onClick={() => setShowDirectCreate(false)}
                        className="px-4 py-1.5 border border-[var(--color-border-strong)] text-sm rounded-lg text-[var(--color-text-muted)]">
                        취소
                      </button>
                    </div>
                  </form>
                )}

                {showAddMember && (
                  <form onSubmit={handleAddMember} className="mb-4 p-4 bg-[var(--color-surface)] rounded-xl shadow flex gap-2 items-end flex-wrap">
                    <div className="flex-1 min-w-48">
                      <label className="block text-xs text-[var(--color-text-muted)] mb-1">이메일</label>
                      <input type="email" value={addEmail} onChange={e => setAddEmail(e.target.value)}
                        placeholder="member@example.com" required className={inputCls + ' w-full'} />
                    </div>
                    <button type="submit" disabled={saving}
                      className="px-4 py-1.5 bg-[var(--color-brand-primary)] text-white text-sm rounded-lg hover:bg-[var(--color-brand-primary-hover)] disabled:opacity-50">
                      {saving ? '추가 중...' : '추가'}
                    </button>
                    <button type="button" onClick={() => setShowAddMember(false)}
                      className="px-4 py-1.5 border border-[var(--color-border-strong)] text-sm rounded-lg text-[var(--color-text-muted)]">
                      취소
                    </button>
                  </form>
                )}

                <div className="bg-[var(--color-surface)] rounded-xl shadow overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-[var(--color-surface-secondary)] border-b border-[var(--color-border)]">
                        <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)]">이름</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)] hidden sm:table-cell">이메일</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)]">역할</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)]">접근권한</th>
                        <th className="px-4 py-3"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--color-border)]">
                      {members.filter(m => m.is_approved).map(m => (
                        <Fragment key={m.user_id}>
                          <tr className="hover:bg-[var(--color-surface-hover)]">
                            <td className="px-4 py-3 font-medium text-[var(--color-text-primary)]">
                              {m.profile?.name ?? '-'}
                              {m.user_id === profile.id && <span className="ml-1.5 text-xs text-[var(--color-text-muted)]">(나)</span>}
                            </td>
                            <td className="px-4 py-3 text-[var(--color-text-muted)] hidden sm:table-cell text-xs">{m.profile?.email ?? '-'}</td>
                            <td className="px-4 py-3">
                              <select
                                value={m.role_id ?? ''}
                                onChange={async e => {
                                  const err = await updateMemberTenantRole(m.user_id, e.target.value || null)
                                  if (err) msg(err, true)
                                }}
                                className="text-xs border border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-primary)]/30"
                              >
                                <option value="">미지정</option>
                                {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                              </select>
                            </td>
                            <td className="px-4 py-3">
                              {m.user_id !== profile.id ? (
                                <select
                                  value={m.role}
                                  onChange={async e => {
                                    const err = await updateMemberAccess(m.user_id, e.target.value as TenantAccessRole)
                                    if (err) msg(err, true)
                                  }}
                                  className="text-xs border border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-primary)]/30"
                                >
                                  <option value="member">멤버</option>
                                  <option value="admin">관리자</option>
                                </select>
                              ) : (
                                <span className="text-xs text-[var(--color-text-muted)]">{m.role === 'admin' ? '관리자' : '멤버'}</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex gap-2 items-center flex-wrap">
                                {/* 자동배정 설정 버튼 */}
                                <button
                                  onClick={() => {
                                    if (expandedPrefUserId === m.user_id) {
                                      setExpandedPrefUserId(null)
                                      return
                                    }
                                    setExpandedPrefUserId(m.user_id)
                                    setPrefDays(m.available_days ?? [])
                                    setPrefLimit(m.monthly_limit?.toString() ?? '')
                                  }}
                                  className="px-2 py-1 text-[10px] border border-[var(--color-border)] rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]"
                                >
                                  자동배정 설정
                                </button>
                                {m.user_id !== profile.id && (
                                  <button
                                    onClick={async () => {
                                      if (!confirm(`${m.profile?.name} 회원을 삭제할까요?`)) return
                                      const err = await removeMember(m.user_id)
                                      if (err) msg(err, true)
                                    }}
                                    className="px-2 py-1 text-xs text-red-600 border border-red-200 rounded hover:bg-red-50"
                                  >
                                    삭제
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                          {/* 인라인 패널 */}
                          {expandedPrefUserId === m.user_id && (
                            <tr>
                              <td colSpan={5} className="px-4 pb-3">
                                <div className="mt-2 p-3 rounded-xl bg-[var(--color-surface-secondary)] border border-[var(--color-border)] space-y-3">
                                  {/* 가능 요일 */}
                                  <div>
                                    <p className="text-[10px] font-semibold text-[var(--color-text-muted)] mb-1.5">가능 요일 (미선택 = 모든 요일)</p>
                                    <div className="flex gap-2">
                                      {['일','월','화','수','목','금','토'].map((label, idx) => (
                                        <label key={idx} className="flex flex-col items-center gap-0.5 cursor-pointer">
                                          <input
                                            type="checkbox"
                                            checked={prefDays.includes(idx)}
                                            onChange={() => setPrefDays(prev =>
                                              prev.includes(idx) ? prev.filter(d => d !== idx) : [...prev, idx].sort((a,b) => a-b)
                                            )}
                                            className="accent-[var(--color-brand-primary)]"
                                          />
                                          <span className="text-[10px] text-[var(--color-text-secondary)]">{label}</span>
                                        </label>
                                      ))}
                                    </div>
                                  </div>
                                  {/* 월별 횟수 제한 */}
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-semibold text-[var(--color-text-muted)]">월별 최대 횟수</span>
                                    <input
                                      type="number" min={1} max={99}
                                      value={prefLimit}
                                      onChange={e => setPrefLimit(e.target.value)}
                                      placeholder="제한없음"
                                      className="w-16 border border-[var(--color-border-strong)] rounded-lg px-2 py-1 text-xs text-center bg-[var(--color-surface)] text-[var(--color-text-primary)] focus:outline-none"
                                    />
                                    <span className="text-[10px] text-[var(--color-text-muted)]">회 (빈칸=무제한)</span>
                                  </div>
                                  {/* 저장 */}
                                  <button
                                    onClick={async () => {
                                      const days = prefDays.length === 0 ? null : prefDays
                                      const limit = prefLimit ? parseInt(prefLimit, 10) : null
                                      const err = await saveMemberPreference(m.user_id, days, limit)
                                      if (!err) setExpandedPrefUserId(null)
                                    }}
                                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-[var(--color-brand-primary)] text-white hover:bg-[var(--color-brand-primary-hover)]"
                                  >
                                    저장
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── 승인 대기 ── */}
            {tab === 'pending' && (
              <div className="max-w-lg">
                <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider font-semibold mb-3">승인 대기 회원</p>
                {(() => {
                  const pendingMembers = members.filter(m => !m.is_approved)
                  if (pendingMembers.length === 0) {
                    return <p className="text-sm text-[var(--color-text-muted)] px-4 py-6 text-center">승인 대기 중인 회원이 없습니다.</p>
                  }
                  return (
                    <div className="bg-[var(--color-surface)] rounded-xl shadow overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-[var(--color-surface-secondary)] border-b border-[var(--color-border)]">
                            <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)]">이름</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)] hidden sm:table-cell">이메일</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)]">역할</th>
                            <th className="px-4 py-3"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--color-border)]">
                          {pendingMembers.map(m => (
                            <tr key={m.user_id} className="hover:bg-[var(--color-surface-hover)]">
                              <td className="px-4 py-3 font-medium text-[var(--color-text-primary)]">{m.profile?.name ?? '-'}</td>
                              <td className="px-4 py-3 text-[var(--color-text-muted)] hidden sm:table-cell text-xs">{m.profile?.email ?? '-'}</td>
                              <td className="px-4 py-3 text-xs text-[var(--color-text-secondary)]">{m.tenant_role?.name ?? '-'}</td>
                              <td className="px-4 py-3">
                                <div className="flex gap-2">
                                  <button
                                    onClick={async () => {
                                      const err = await approveUser(m.user_id)
                                      if (err) msg(err, true)
                                      else msg(`${m.profile?.name ?? '회원'}을(를) 승인했습니다.`)
                                    }}
                                    className="px-3 py-1 text-xs font-medium rounded-lg bg-green-500 text-white hover:bg-green-600 transition-colors"
                                  >
                                    승인
                                  </button>
                                  <button
                                    onClick={async () => {
                                      if (!confirm(`"${m.profile?.name ?? '회원'}"을(를) 거절하고 조직에서 제외할까요?`)) return
                                      const err = await removeMember(m.user_id)
                                      if (err) msg(err, true)
                                    }}
                                    className="px-3 py-1 text-xs font-medium rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                                  >
                                    거절
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )
                })()}

                {/* 탈퇴 신청 */}
                {(() => {
                  const withdrawalPending = members.filter(m => m.withdrawal_status === 'pending')
                  if (!withdrawalPending.length) return null
                  return (
                    <div className="mt-6">
                      <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider font-semibold mb-3">
                        탈퇴 신청 ({withdrawalPending.length}건)
                      </p>
                      <div className="space-y-2">
                        {withdrawalPending.map(m => (
                          <div key={m.id} className="flex items-center justify-between px-4 py-3 rounded-xl bg-[var(--color-surface-secondary)] border border-[var(--color-border)]">
                            <div>
                              <p className="text-sm font-medium text-[var(--color-text-primary)]">{m.profile?.name}</p>
                              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                                신청일: {m.withdrawal_requested_at
                                  ? new Date(m.withdrawal_requested_at).toLocaleDateString('ko-KR')
                                  : '-'}
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => approveWithdrawal(m.user_id)}
                                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors"
                              >
                                승인
                              </button>
                              <button
                                onClick={() => rejectWithdrawal(m.user_id)}
                                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-[var(--color-border-strong)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] transition-colors"
                              >
                                거절
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })()}
              </div>
            )}

            {/* ── 역할 관리 ── */}
            {tab === 'roles' && (
              <div className="max-w-lg">
                <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider font-semibold mb-3">역할 목록</p>
                <div className="bg-[var(--color-surface)] rounded-xl shadow overflow-x-auto mb-4">
                  {roles.length === 0 ? (
                    <p className="text-sm text-[var(--color-text-muted)] px-4 py-6 text-center">등록된 역할이 없습니다.</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-[var(--color-surface-secondary)] border-b border-[var(--color-border)]">
                          <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)]">역할명</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)]">셀 분리</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)]">바표시</th>
                          <th className="px-4 py-3"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--color-border)]">
                        {[...roles].sort((a, b) => a.display_order - b.display_order).map((r, idx, sortedRoles) => (
                          <tr key={r.id} className="hover:bg-[var(--color-surface-hover)]">
                            <td className="px-4 py-3">
                              {editingRoleId === r.id ? (
                                <div className="flex items-center gap-1.5">
                                  <input
                                    value={editRoleName}
                                    onChange={e => setEditRoleName(e.target.value)}
                                    onKeyDown={async e => {
                                      if (e.key === 'Enter') {
                                        if (!editRoleName.trim()) return
                                        const err = await updateRole(r.id, { name: editRoleName.trim() })
                                        if (err) msg(err, true)
                                        else setEditingRoleId(null)
                                      }
                                      if (e.key === 'Escape') setEditingRoleId(null)
                                    }}
                                    className={inputCls + ' w-32 text-sm py-1'}
                                    autoFocus
                                  />
                                  <button type="button"
                                    onClick={async () => {
                                      if (!editRoleName.trim()) return
                                      const err = await updateRole(r.id, { name: editRoleName.trim() })
                                      if (err) msg(err, true)
                                      else setEditingRoleId(null)
                                    }}
                                    className="px-2 py-1 text-xs bg-[var(--color-brand-primary)] text-white rounded hover:bg-[var(--color-brand-primary-hover)]">
                                    저장
                                  </button>
                                  <button type="button" onClick={() => setEditingRoleId(null)}
                                    className="px-2 py-1 text-xs border border-[var(--color-border-strong)] rounded hover:bg-[var(--color-surface-hover)]">
                                    취소
                                  </button>
                                </div>
                              ) : (
                                <button type="button"
                                  onClick={() => { setEditingRoleId(r.id); setEditRoleName(r.name) }}
                                  className="font-medium text-[var(--color-text-primary)] hover:text-[var(--color-brand-primary)] text-left">
                                  {r.name}
                                </button>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <button
                                onClick={async () => {
                                  const err = await updateRole(r.id, { split_cell: !r.split_cell })
                                  if (err) msg(err, true)
                                }}
                                className={`inline-flex px-2 py-0.5 rounded text-xs font-medium cursor-pointer transition-colors
                                  ${r.split_cell
                                    ? 'bg-[var(--color-brand-primary)]/10 text-[var(--color-brand-primary)] hover:bg-[var(--color-brand-primary)]/20'
                                    : 'bg-[var(--color-surface-secondary)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]'}`}
                              >
                                {r.split_cell ? '분리' : '미분리'}
                              </button>
                            </td>
                            <td className="px-4 py-3">
                              <button
                                onClick={async () => {
                                  const err = await updateRole(r.id, { indicator_bar: !r.indicator_bar })
                                  if (err) msg(err, true)
                                }}
                                title="셀 분리 대신 좌측 컬러 바로 표시"
                                className={`inline-flex px-2 py-0.5 rounded text-xs font-medium cursor-pointer transition-colors
                                  ${r.indicator_bar
                                    ? 'bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-400'
                                    : 'bg-[var(--color-surface-secondary)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]'}`}
                              >
                                {r.indicator_bar ? '바 표시' : '바 없음'}
                              </button>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex gap-1 items-center">
                                <button type="button" onClick={() => moveRole(r.id, -1)} disabled={idx === 0}
                                  className="px-1.5 py-1 text-xs border border-[var(--color-border)] rounded hover:bg-[var(--color-surface-hover)] disabled:opacity-30">↑</button>
                                <button type="button" onClick={() => moveRole(r.id, 1)} disabled={idx === sortedRoles.length - 1}
                                  className="px-1.5 py-1 text-xs border border-[var(--color-border)] rounded hover:bg-[var(--color-surface-hover)] disabled:opacity-30">↓</button>
                                <button
                                  onClick={async () => {
                                    if (!confirm(`"${r.name}" 역할을 삭제할까요?`)) return
                                    const err = await deleteRole(r.id)
                                    if (err) msg(err, true)
                                  }}
                                  className="px-2 py-1 text-xs text-red-600 border border-red-200 rounded hover:bg-red-50"
                                >
                                  삭제
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                <form onSubmit={handleAddRole} className="bg-[var(--color-surface)] rounded-xl shadow p-4 space-y-3">
                  <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">역할 추가</p>
                  <div>
                    <label className="block text-xs text-[var(--color-text-muted)] mb-1">역할명</label>
                    <input type="text" value={newRoleName} onChange={e => setNewRoleName(e.target.value)}
                      placeholder="예: 팀장" maxLength={30} className={inputCls + ' w-full'} required />
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={newRoleSplitCell} onChange={e => setNewRoleSplitCell(e.target.checked)}
                      className="rounded border-[var(--color-border-strong)] accent-[var(--color-brand-primary)]" />
                    <span className="text-sm text-[var(--color-text-secondary)]">셀 분리 (역할별 별도 컬럼)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={newRoleIndicatorBar} onChange={e => setNewRoleIndicatorBar(e.target.checked)}
                      className="rounded border-[var(--color-border-strong)] accent-[var(--color-brand-primary)]" />
                    <span className="text-sm text-[var(--color-text-secondary)]">바 표시 (좌측 컬러 바로 표시)</span>
                  </label>
                  <button type="submit" className="px-4 py-1.5 bg-[var(--color-brand-primary)] text-white text-sm rounded-lg hover:bg-[var(--color-brand-primary-hover)]">추가</button>
                </form>
              </div>
            )}

            {/* ── 스케줄 규칙 ── */}
            {tab === 'rules' && (
              <div>
                <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider font-semibold mb-3">요일별 운영 규칙</p>

                {/* Missing rules banner */}
                {adminTimeSlots.some(slot => !scheduleRules.some(r => r.time_slot === slot)) && (
                  <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center justify-between gap-3">
                    <span className="text-sm text-yellow-700">일부 슬롯에 규칙이 없습니다. 규칙을 생성해 주세요.</span>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={async () => {
                        setSaving(true)
                        const err = await upsertScheduleRulesForSlots(adminTimeSlots)
                        setSaving(false)
                        if (err) msg(err, true)
                        else msg('규칙이 생성됐습니다.')
                      }}
                      className="shrink-0 px-3 py-1.5 text-xs font-medium bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50"
                    >
                      {saving ? '생성 중...' : '전체 규칙 생성'}
                    </button>
                  </div>
                )}

                <div className="bg-[var(--color-surface)] rounded-xl shadow overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-[var(--color-surface-secondary)] border-b border-[var(--color-border)]">
                        <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)]">시간</th>
                        {DAY_LABELS.map(d => (
                          <th key={d} className="px-3 py-3 text-xs font-semibold text-[var(--color-text-muted)] text-center">{d}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--color-border)]">
                      {adminTimeSlots.map(slot => (
                        <tr key={slot}>
                          <td className="px-4 py-2.5 font-medium text-[var(--color-text-secondary)] whitespace-nowrap">{parseSlotLabel(slot)}</td>
                          {DAY_LABELS.map((_, dayIdx) => {
                            const rule = getRule(dayIdx, slot)
                            return (
                              <td key={dayIdx} className="px-3 py-2.5 text-center">
                                {rule ? (
                                  <button onClick={async () => {
                                    const err = await toggleScheduleRule(rule.id, rule.is_open)
                                    if (err) msg(err, true)
                                  }}
                                    className={`px-2.5 py-0.5 rounded text-xs font-medium transition-colors ${rule.is_open ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-[var(--color-surface-secondary)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]'}`}>
                                    {rule.is_open ? '운영' : '미운영'}
                                  </button>
                                ) : <span className="text-[var(--color-border-strong)]">-</span>}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-2 text-xs text-[var(--color-text-muted)]">버튼 클릭 시 즉시 저장됩니다.</p>
              </div>
            )}

            {/* ── 날짜 설정 ── */}
            {tab === 'dates' && (
              <div className="space-y-6">
                <div>
                  <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider font-semibold mb-3">날짜 추가</p>
                  <form onSubmit={handleDateSubmit} className="bg-[var(--color-surface)] rounded-xl shadow p-4">
                    <div className="flex flex-wrap gap-3 items-end">
                      <div>
                        <label className="block text-xs text-[var(--color-text-muted)] mb-1">날짜</label>
                        <input type="date" value={dateForm.date} onChange={e => setDateForm(f => ({ ...f, date: e.target.value }))} required className={inputCls} />
                      </div>
                      <div>
                        <label className="block text-xs text-[var(--color-text-muted)] mb-1">유형</label>
                        <select value={dateForm.type} onChange={e => setDateForm(f => ({ ...f, type: e.target.value as 'holiday' | 'special' }))} className={inputCls}>
                          <option value="holiday">휴관일</option>
                          <option value="special">특별 운영일</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-[var(--color-text-muted)] mb-1">레이블 (선택)</label>
                        <input type="text" value={dateForm.label} onChange={e => setDateForm(f => ({ ...f, label: e.target.value }))} placeholder="예: 추석연휴" maxLength={100} className={inputCls + ' w-36'} />
                      </div>
                      <button type="submit" disabled={saving} className="px-4 py-1.5 bg-[var(--color-brand-primary)] text-white text-sm rounded-lg hover:bg-[var(--color-brand-primary-hover)] disabled:opacity-50">
                        {saving ? '저장 중...' : '추가'}
                      </button>
                    </div>
                  </form>
                </div>
                <div>
                  <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider font-semibold mb-3">설정된 날짜 ({dateOverrides.length}건)</p>
                  {dateOverrides.length === 0 ? <p className="text-sm text-[var(--color-text-muted)]">설정된 날짜가 없습니다.</p> : (
                    <div className="bg-[var(--color-surface)] rounded-xl shadow overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-[var(--color-surface-secondary)] border-b border-[var(--color-border)]">
                            <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)]">날짜</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)]">유형</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)]">레이블</th>
                            <th className="px-4 py-3"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--color-border)]">
                          {dateOverrides.map(d => (
                            <tr key={d.id} className="hover:bg-[var(--color-surface-hover)]">
                              <td className="px-4 py-3 font-medium text-[var(--color-text-primary)]">{d.date}</td>
                              <td className="px-4 py-3">
                                <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${d.is_holiday ? 'bg-red-100 text-red-700' : 'bg-[var(--color-brand-primary)]/10 text-[var(--color-brand-primary)]'}`}>
                                  {d.is_holiday ? '휴관일' : '특별운영'}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-[var(--color-text-muted)]">{d.label ?? '-'}</td>
                              <td className="px-4 py-3">
                                <button onClick={async () => { const err = await deleteDateOverride(d.id); if (err) msg(err, true) }}
                                  className="px-2.5 py-1 text-xs text-red-600 border border-red-200 rounded hover:bg-red-50">
                                  삭제
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── 조직 설정 ── */}
            {tab === 'settings' && (
              <form onSubmit={handleSettingsSave} className="max-w-lg space-y-6">
                <div className="bg-[var(--color-surface)] rounded-xl shadow p-5 space-y-4">
                  <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider font-semibold">기본 정보</p>
                  <div>
                    <label className="block text-xs text-[var(--color-text-muted)] mb-1">조직명</label>
                    <input type="text" value={settingsName} onChange={e => setSettingsName(e.target.value)} maxLength={50} className={inputCls + ' w-full'} />
                  </div>
                  <div>
                    <label className="block text-xs text-[var(--color-text-muted)] mb-1">페이지 타이틀</label>
                    <input type="text" value={settingsTitle} onChange={e => setSettingsTitle(e.target.value)} maxLength={50} className={inputCls + ' w-full'} />
                  </div>
                  <div>
                    <label className="block text-xs text-[var(--color-text-muted)] mb-1">테마 색상 (#RRGGBB, 선택)</label>
                    <input type="text" value={settingsTheme} onChange={e => setSettingsTheme(e.target.value)} placeholder="#2563eb" maxLength={7} className={inputCls + ' w-full'} />
                  </div>
                  <div>
                    <label className="block text-xs text-[var(--color-text-muted)] mb-1">자원봉사자 역할 레이블 (기본: 자원봉사자)</label>
                    <input type="text" value={settingsVolunteerLabel} onChange={e => setSettingsVolunteerLabel(e.target.value)} placeholder="자원봉사자" maxLength={20} className={inputCls + ' w-full'} />
                  </div>
                  <div>
                    <label className="block text-xs text-[var(--color-text-muted)] mb-1">50플러스 역할 레이블 (기본: 50플러스활동가)</label>
                    <input type="text" value={settingsPlusLabel} onChange={e => setSettingsPlusLabel(e.target.value)} placeholder="50플러스활동가" maxLength={20} className={inputCls + ' w-full'} />
                  </div>
                </div>

                <div className="bg-[var(--color-surface)] rounded-xl shadow p-5 space-y-4">
                  <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider font-semibold">타임슬롯</p>

                  {/* Templates */}
                  <div>
                    <p className="text-xs text-[var(--color-text-muted)] mb-2">템플릿 적용</p>
                    <div className="flex gap-2 flex-wrap">
                      {SLOT_TEMPLATES.map(t => (
                        <button key={t.label} type="button"
                          onClick={() => setSlotList(t.slots)}
                          className="px-3 py-1.5 text-xs rounded-lg border border-[var(--color-border-strong)] text-[var(--color-text-secondary)] hover:border-[var(--color-brand-primary)] hover:text-[var(--color-brand-primary)] hover:bg-[var(--color-surface-hover)] transition-colors">
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Manual add */}
                  <div>
                    <p className="text-xs text-[var(--color-text-muted)] mb-2">직접 추가</p>
                    <div className="flex items-end gap-2 flex-wrap">
                      <div>
                        <label className="block text-xs text-[var(--color-text-muted)] mb-1">시작</label>
                        <select value={slotStart} onChange={e => setSlotStart(Number(e.target.value))} className={inputCls}>
                          {START_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-[var(--color-text-muted)] mb-1">종료</label>
                        <select value={slotEnd} onChange={e => setSlotEnd(Number(e.target.value))} className={inputCls}>
                          {END_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </div>
                      <button type="button" onClick={handleAddSlot}
                        className="px-3 py-1.5 text-sm border border-[var(--color-brand-primary)] text-[var(--color-brand-primary)] rounded-lg hover:bg-[var(--color-surface-hover)]">
                        + 추가
                      </button>
                    </div>
                  </div>

                  {slotList.length === 0 ? (
                    <p className="text-xs text-[var(--color-text-muted)]">등록된 슬롯이 없습니다.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {slotList.map(slot => (
                        <li key={slot} className="flex items-center gap-2 px-3 py-2 bg-[var(--color-surface-secondary)] rounded-lg">
                          <span className="text-sm text-[var(--color-text-secondary)] w-32 shrink-0">{parseSlotLabel(slot)}</span>
                          <input
                            type="text"
                            placeholder="레이블 (예: 햇님타임)"
                            value={slotLabels[slot] ?? ''}
                            onChange={e => setSlotLabels(prev => {
                              const next = { ...prev }
                              if (e.target.value) next[slot] = e.target.value
                              else delete next[slot]
                              return next
                            })}
                            className="flex-1 text-sm border border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-text-primary)] rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-primary)]/30 focus:border-[var(--color-brand-primary)]"
                          />
                          <button type="button" onClick={() => {
                            setSlotList(prev => prev.filter(s => s !== slot))
                            setSlotLabels(prev => { const n = { ...prev }; delete n[slot]; return n })
                          }} className="text-xs text-red-500 hover:text-red-700 shrink-0">삭제</button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {roles.length > 0 && (
                  <div className="bg-[var(--color-surface)] rounded-xl shadow p-5">
                    <div className="pt-0 border-t-0">
                      <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider font-semibold mb-3">
                        자동배정 역할 비율 (합계 100%)
                      </p>
                      <div className="space-y-2">
                        {roles.map(role => (
                          <div key={role.id} className="flex items-center gap-3">
                            <span className="text-sm text-[var(--color-text-secondary)] w-32 shrink-0">{role.name}</span>
                            <input
                              type="number" min={0} max={100}
                              value={roleRatios[role.id] ?? 0}
                              onChange={e => setRoleRatios(prev => ({ ...prev, [role.id]: parseInt(e.target.value, 10) || 0 }))}
                              className="w-16 border border-[var(--color-border-strong)] rounded-lg px-2 py-1 text-sm text-center bg-[var(--color-surface)] text-[var(--color-text-primary)] focus:outline-none"
                            />
                            <span className="text-xs text-[var(--color-text-muted)]">%</span>
                          </div>
                        ))}
                        <p className="text-xs text-[var(--color-text-muted)]">
                          합계: {Object.values(roleRatios).reduce((s, v) => s + v, 0)}%
                          {Object.keys(roleRatios).length > 0 && Object.values(roleRatios).reduce((s, v) => s + v, 0) !== 100
                            ? <span className="text-red-500 ml-1">(100%이 아닙니다)</span>
                            : null}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleRatioSave}
                        disabled={ratioSaving}
                        className="mt-3 px-4 py-2 text-sm font-semibold rounded-xl bg-[var(--color-brand-primary)] text-white hover:bg-[var(--color-brand-primary-hover)] disabled:opacity-50"
                      >
                        {ratioSaving ? '저장 중...' : '비율 저장'}
                      </button>
                    </div>
                  </div>
                )}

                <button type="submit" disabled={saving}
                  className="px-5 py-2 bg-[var(--color-brand-primary)] text-white text-sm rounded-lg hover:bg-[var(--color-brand-primary-hover)] disabled:opacity-50">
                  {saving ? '저장 중...' : '저장'}
                </button>
              </form>
            )}

            {/* ── 범례 관리 ── */}
            {tab === 'legend' && (
              <div className="max-w-lg space-y-4">
                <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider font-semibold">
                  범례 항목 ({legendItems.length}개) — 추가/삭제 즉시 저장됩니다
                </p>

                {legendItems.length === 0 && (
                  <p className="text-xs text-[var(--color-text-muted)]">항목이 없으면 기본 범례가 표시됩니다.</p>
                )}

                <ul className="space-y-2">
                  {legendItems.map((item, idx) => {
                    const isEditing = editingLegendId === item.id
                    const s = LEGEND_COLOR_STYLES[isEditing ? editLegendColor : item.color]
                    return (
                      <li key={item.id} className={`rounded-lg border p-2.5 ${s.bg} ${s.border}`}>
                        {isEditing ? (
                          <div className="flex gap-2 flex-wrap items-end">
                            <input
                              type="text" maxLength={2}
                              value={editLegendIcon}
                              onChange={e => setEditLegendIcon(e.target.value)}
                              className={inputCls + ' w-14 text-center'}
                            />
                            <input
                              type="text"
                              value={editLegendLabel}
                              onChange={e => setEditLegendLabel(e.target.value)}
                              maxLength={50}
                              className={inputCls + ' flex-1 min-w-32'}
                            />
                            <select
                              value={editLegendColor}
                              onChange={e => setEditLegendColor(e.target.value as LegendColor)}
                              className={inputCls}
                            >
                              <option value="amber">주황</option>
                              <option value="pink">분홍</option>
                              <option value="yellow">노랑</option>
                              <option value="blue">파랑</option>
                              <option value="green">초록</option>
                              <option value="purple">보라</option>
                              <option value="red">빨강</option>
                              <option value="slate">회색</option>
                              <option value="indigo">남색</option>
                            </select>
                            <button type="button" onClick={saveLegendEdit}
                              disabled={!editLegendIcon.trim() || !editLegendLabel.trim()}
                              className="px-3 py-1 text-xs bg-[var(--color-brand-primary)] text-white rounded hover:bg-[var(--color-brand-primary-hover)] disabled:opacity-40 shrink-0">
                              저장
                            </button>
                            <button type="button" onClick={() => setEditingLegendId(null)}
                              className="px-3 py-1 text-xs border border-[var(--color-border-strong)] rounded hover:bg-[var(--color-surface-hover)] shrink-0">
                              취소
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className={`text-[11px] font-bold ${s.icon}`}>{item.icon}</span>
                            <span className="text-xs text-[var(--color-text-secondary)] font-medium flex-1">{item.label}</span>
                            <div className="flex gap-1 shrink-0">
                              <button type="button" onClick={() => moveLegendItem(item.id, -1)} disabled={idx === 0}
                                className="px-1.5 py-1 text-xs border border-[var(--color-border-strong)] rounded hover:bg-[var(--color-surface-hover)] disabled:opacity-30">↑</button>
                              <button type="button" onClick={() => moveLegendItem(item.id, 1)} disabled={idx === legendItems.length - 1}
                                className="px-1.5 py-1 text-xs border border-[var(--color-border-strong)] rounded hover:bg-[var(--color-surface-hover)] disabled:opacity-30">↓</button>
                            </div>
                            <button type="button" onClick={() => startEditLegend(item)}
                              className="px-2 py-1 text-xs border border-[var(--color-border-strong)] rounded hover:bg-[var(--color-surface-hover)] shrink-0">
                              수정
                            </button>
                            <button type="button" onClick={() => removeLegendItem(item.id)}
                              className="px-2 py-1 text-xs text-red-600 border border-red-200 rounded hover:bg-red-50 shrink-0">
                              삭제
                            </button>
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ul>

                <div className="bg-[var(--color-surface)] rounded-xl shadow p-4 space-y-3">
                  <p className="text-xs font-semibold text-[var(--color-text-muted)]">새 항목 추가</p>
                  <div className="flex gap-2 flex-wrap items-end">
                    <div>
                      <label className="block text-xs text-[var(--color-text-muted)] mb-1">아이콘</label>
                      <input
                        type="text"
                        maxLength={2}
                        value={newLegendIcon}
                        onChange={e => setNewLegendIcon(e.target.value)}
                        placeholder="☀"
                        className={inputCls + ' w-14 text-center'}
                      />
                    </div>
                    <div className="flex-1 min-w-40">
                      <label className="block text-xs text-[var(--color-text-muted)] mb-1">레이블</label>
                      <input
                        type="text"
                        value={newLegendLabel}
                        onChange={e => setNewLegendLabel(e.target.value)}
                        placeholder="햇님타임 (10~18시)"
                        maxLength={50}
                        className={inputCls + ' w-full'}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-[var(--color-text-muted)] mb-1">색상</label>
                      <select
                        value={newLegendColor}
                        onChange={e => setNewLegendColor(e.target.value as LegendColor)}
                        className={inputCls}
                      >
                        <option value="amber">주황</option>
                        <option value="pink">분홍</option>
                        <option value="yellow">노랑</option>
                        <option value="blue">파랑</option>
                        <option value="green">초록</option>
                        <option value="purple">보라</option>
                        <option value="red">빨강</option>
                        <option value="slate">회색</option>
                        <option value="indigo">남색</option>
                      </select>
                    </div>
                    <button
                      type="button"
                      onClick={addLegendItem}
                      disabled={!newLegendIcon.trim() || !newLegendLabel.trim()}
                      className="px-4 py-1.5 text-sm bg-[var(--color-brand-primary)] text-white rounded-lg hover:bg-[var(--color-brand-primary-hover)] disabled:opacity-40"
                    >
                      + 추가
                    </button>
                  </div>
                </div>
              </div>
            )}
            {/* ── 입력 필드 관리 ── */}
            {tab === 'custom_fields' && (
              <div className="max-w-lg space-y-4">
                <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider font-semibold">
                  직접입력 모드 커스텀 필드 ({customFields.length}개)
                  {customFields.length > 0 && <span className="ml-2 normal-case font-normal text-[var(--color-brand-primary)]">첫 번째 필드가 이름(성명) 필드로 사용됩니다</span>}
                </p>

                {customFields.length === 0 && (
                  <p className="text-xs text-[var(--color-text-muted)]">필드가 없으면 기본 이름+연락처 입력이 표시됩니다.</p>
                )}

                <ul className="space-y-2">
                  {customFields.map((field, idx) => {
                    const isEditing = editingFieldId === field.id
                    return (
                      <li key={field.id} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
                        {isEditing ? (
                          <div className="space-y-2">
                            <input
                              type="text"
                              value={editField.label}
                              onChange={e => setEditField(f => ({ ...f, label: e.target.value }))}
                              placeholder="필드명"
                              className={inputCls + ' w-full'}
                            />
                            <div className="flex gap-2 flex-wrap">
                              <select
                                value={editField.type}
                                onChange={e => setEditField(f => ({ ...f, type: e.target.value as 'text' | 'select' }))}
                                className={inputCls}
                              >
                                <option value="text">텍스트</option>
                                <option value="select">선택(드롭다운)</option>
                              </select>
                              <label className="flex items-center gap-1.5 text-sm text-[var(--color-text-secondary)] cursor-pointer">
                                <input type="checkbox" checked={editField.required} onChange={e => setEditField(f => ({ ...f, required: e.target.checked }))} className="accent-[var(--color-brand-primary)]" />
                                필수
                              </label>
                            </div>
                            {editField.type === 'select' && (
                              <div className="space-y-1.5">
                                <p className="text-xs text-[var(--color-text-muted)]">선택지 (표시명 / 저장값)</p>
                                {(editField.options ?? []).map((opt, oi) => (
                                  <div key={oi} className="flex gap-1.5 items-center">
                                    <input
                                      type="text"
                                      value={opt.name}
                                      onChange={e => setEditField(f => ({ ...f, options: (f.options ?? []).map((o, i) => i === oi ? { ...o, name: e.target.value } : o) }))}
                                      placeholder="표시명"
                                      className={inputCls + ' flex-1 min-w-0'}
                                    />
                                    <input
                                      type="text"
                                      value={opt.value}
                                      onChange={e => setEditField(f => ({ ...f, options: (f.options ?? []).map((o, i) => i === oi ? { ...o, value: e.target.value } : o) }))}
                                      placeholder="저장값"
                                      className={inputCls + ' flex-1 min-w-0'}
                                    />
                                    <button type="button" onClick={() => setEditField(f => ({ ...f, options: (f.options ?? []).filter((_, i) => i !== oi) }))}
                                      className="text-red-400 hover:text-red-600 text-xs px-1">✕</button>
                                  </div>
                                ))}
                                <button type="button" onClick={() => setEditField(f => ({ ...f, options: [...(f.options ?? []), { name: '', value: '' }] }))}
                                  className="text-xs text-[var(--color-brand-primary)] hover:underline">+ 옵션 추가</button>
                                <label className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)] cursor-pointer pt-1">
                                  <input type="checkbox" checked={!!editField.show_in_dashboard} onChange={e => setEditField(f => ({ ...f, show_in_dashboard: e.target.checked }))} className="accent-[var(--color-brand-primary)]" />
                                  대시보드 통계 포함
                                </label>
                              </div>
                            )}
                            <input
                              type="text"
                              value={editField.placeholder ?? ''}
                              onChange={e => setEditField(f => ({ ...f, placeholder: e.target.value }))}
                              placeholder="플레이스홀더 (선택)"
                              className={inputCls + ' w-full'}
                            />
                            <div className="flex gap-2">
                              <button type="button" onClick={saveFieldEdit}
                                className="px-3 py-1 text-xs bg-[var(--color-brand-primary)] text-white rounded-lg hover:bg-[var(--color-brand-primary-hover)]">저장</button>
                              <button type="button" onClick={() => setEditingFieldId(null)}
                                className="px-3 py-1 text-xs border border-[var(--color-border-strong)] rounded-lg hover:bg-[var(--color-surface-hover)]">취소</button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <div className="flex-1 min-w-0">
                              <span className="text-sm font-medium text-[var(--color-text-primary)]">{field.label}</span>
                              {idx === 0 && <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-brand-primary)]/10 text-[var(--color-brand-primary)] font-semibold">이름</span>}
                              <span className="ml-2 text-xs text-[var(--color-text-muted)]">{field.type === 'select' ? `선택 (${(field.options ?? []).map(o => o.name).join(', ')})` : '텍스트'}</span>
                              {field.required && <span className="ml-1 text-xs text-red-500">*필수</span>}
                              {field.show_in_dashboard && <span className="ml-1 text-[10px] px-1 py-0.5 rounded bg-blue-50 text-blue-600 font-semibold">대시보드</span>}
                            </div>
                            <div className="flex gap-1 shrink-0">
                              <button type="button" onClick={() => moveField(field.id, -1)} disabled={idx === 0}
                                className="px-1.5 py-1 text-xs border border-[var(--color-border)] rounded hover:bg-[var(--color-surface-hover)] disabled:opacity-30">↑</button>
                              <button type="button" onClick={() => moveField(field.id, 1)} disabled={idx === customFields.length - 1}
                                className="px-1.5 py-1 text-xs border border-[var(--color-border)] rounded hover:bg-[var(--color-surface-hover)] disabled:opacity-30">↓</button>
                              <button type="button" onClick={() => { setEditingFieldId(field.id); setEditField({ label: field.label, type: field.type, required: field.required, options: field.options ?? [], placeholder: field.placeholder ?? '', show_in_dashboard: field.show_in_dashboard ?? false }) }}
                                className="px-2 py-1 text-xs border border-[var(--color-border-strong)] rounded hover:bg-[var(--color-surface-hover)]">수정</button>
                              <button type="button" onClick={async () => { if (!confirm(`"${field.label}" 필드를 삭제할까요?`)) return; await removeCustomField(field.id) }}
                                className="px-2 py-1 text-xs text-red-600 border border-red-200 rounded hover:bg-red-50">삭제</button>
                            </div>
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ul>

                <form onSubmit={addCustomField} className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-4 space-y-3">
                  <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">새 필드 추가</p>
                  <div>
                    <label className="block text-xs text-[var(--color-text-muted)] mb-1">필드명 *</label>
                    <input type="text" required value={newFieldLabel} onChange={e => setNewFieldLabel(e.target.value)}
                      placeholder="예: 성명, 컷트/파마 여부, 위치" maxLength={50} className={inputCls + ' w-full'} />
                  </div>
                  <div className="flex gap-3 flex-wrap items-center">
                    <div>
                      <label className="block text-xs text-[var(--color-text-muted)] mb-1">타입</label>
                      <select value={newFieldType} onChange={e => setNewFieldType(e.target.value as 'text' | 'select')} className={inputCls}>
                        <option value="text">텍스트</option>
                        <option value="select">선택(드롭다운)</option>
                      </select>
                    </div>
                    <label className="flex items-center gap-1.5 text-sm text-[var(--color-text-secondary)] cursor-pointer mt-4">
                      <input type="checkbox" checked={newFieldRequired} onChange={e => setNewFieldRequired(e.target.checked)} className="accent-[var(--color-brand-primary)]" />
                      필수 입력
                    </label>
                  </div>
                  {newFieldType === 'select' && (
                    <div className="space-y-1.5">
                      <label className="block text-xs text-[var(--color-text-muted)]">선택지 (표시명 / 저장값)</label>
                      {newFieldOptions.map((opt, oi) => (
                        <div key={oi} className="flex gap-1.5 items-center">
                          <input
                            type="text"
                            value={opt.name}
                            onChange={e => setNewFieldOptions(prev => prev.map((o, i) => i === oi ? { ...o, name: e.target.value } : o))}
                            placeholder="표시명"
                            className={inputCls + ' flex-1 min-w-0'}
                          />
                          <input
                            type="text"
                            value={opt.value}
                            onChange={e => setNewFieldOptions(prev => prev.map((o, i) => i === oi ? { ...o, value: e.target.value } : o))}
                            placeholder="저장값"
                            className={inputCls + ' flex-1 min-w-0'}
                          />
                          <button type="button" onClick={() => setNewFieldOptions(prev => prev.filter((_, i) => i !== oi))}
                            className="text-red-400 hover:text-red-600 text-xs px-1">✕</button>
                        </div>
                      ))}
                      <button type="button" onClick={() => setNewFieldOptions(prev => [...prev, { name: '', value: '' }])}
                        className="text-xs text-[var(--color-brand-primary)] hover:underline">+ 옵션 추가</button>
                      <label className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)] cursor-pointer pt-1">
                        <input type="checkbox" checked={newFieldShowInDashboard} onChange={e => setNewFieldShowInDashboard(e.target.checked)} className="accent-[var(--color-brand-primary)]" />
                        대시보드 통계 포함
                      </label>
                    </div>
                  )}
                  <div>
                    <label className="block text-xs text-[var(--color-text-muted)] mb-1">플레이스홀더 (선택)</label>
                    <input type="text" value={newFieldPlaceholder} onChange={e => setNewFieldPlaceholder(e.target.value)}
                      placeholder="입력 안내 문구" maxLength={100} className={inputCls + ' w-full'} />
                  </div>
                  <button type="submit" className="px-4 py-1.5 bg-[var(--color-brand-primary)] text-white text-sm rounded-lg hover:bg-[var(--color-brand-primary-hover)]">
                    + 추가
                  </button>
                </form>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
