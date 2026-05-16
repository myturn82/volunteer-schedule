import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useAdmin } from '../hooks/useAdmin'
import { useTenant } from '../contexts/TenantContext'
import { useTenantRoles } from '../hooks/useTenantRoles'
import { supabase } from '../lib/supabase'
import { buildSlot, parseSlotLabel, generateTimeSlots, DEFAULT_TIME_SLOTS, SLOT_TEMPLATES } from '../utils/timeSlots'
import type { TimeSlot, Tenant, TenantAccessRole, LegendItem, LegendColor } from '../types'
import { LEGEND_COLOR_STYLES } from '../components/schedule/Legend'

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']

function makeTimeOpt(halfHours: number) {
  const h = Math.floor(halfHours / 2)
  const m = halfHours % 2 === 0 ? '00' : '30'
  return { value: halfHours / 2, label: `${h}:${m}` }
}
const START_OPTIONS = Array.from({ length: 48 }, (_, i) => makeTimeOpt(i))
const END_OPTIONS   = Array.from({ length: 48 }, (_, i) => makeTimeOpt(i + 1))

type Tab = 'members' | 'roles' | 'rules' | 'dates' | 'settings' | 'legend'

const TAB_LABELS: Record<Tab, string> = {
  members: '회원 관리',
  roles: '역할 관리',
  rules: '스케줄 규칙',
  dates: '날짜 설정',
  settings: '조직 설정',
  legend: '범례 관리',
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
    addMember, removeMember, updateMemberTenantRole, updateMemberAccess,
    toggleScheduleRule, upsertScheduleRulesForSlots,
    addDateOverride, deleteDateOverride,
    updateTenantSettings, updateTenantName,
  } = useAdmin(adminTenantId)
  const { roles, addRole, deleteRole, updateRole } = useTenantRoles(adminTenantId)

  const [tab, setTab] = useState<Tab>('members')
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null)
  const [saving, setSaving] = useState(false)

  // Members tab
  const [showAddMember, setShowAddMember] = useState(false)
  const [addEmail, setAddEmail] = useState('')

  // 직접 등록 (이메일 인증 없이 테스트 계정 생성)
  const [showDirectCreate, setShowDirectCreate] = useState(false)
  const [directForm, setDirectForm] = useState({ email: '', name: '', password: '', roleId: '' })
  const [directSaving, setDirectSaving] = useState(false)

  // Roles tab
  const [newRoleName, setNewRoleName] = useState('')
  const [newRoleSplitCell, setNewRoleSplitCell] = useState(false)
  const [newRoleRequiresCustomerInfo, setNewRoleRequiresCustomerInfo] = useState(false)

  // Dates tab
  const [dateForm, setDateForm] = useState({ date: '', type: 'holiday' as 'holiday' | 'special', label: '' })

  // Settings tab — derived from adminTenant
  const [slotList, setSlotList] = useState<string[]>([])
  const [slotStart, setSlotStart] = useState(10)
  const [slotEnd, setSlotEnd] = useState(12)
  const [settingsName, setSettingsName] = useState('')
  const [settingsTitle, setSettingsTitle] = useState('')
  const [settingsTheme, setSettingsTheme] = useState('')
  const [slotLabels, setSlotLabels] = useState<Record<string, string>>({})
  const [legendItems, setLegendItems] = useState<LegendItem[]>([])
  const [newLegendIcon, setNewLegendIcon] = useState('')
  const [newLegendLabel, setNewLegendLabel] = useState('')
  const [newLegendColor, setNewLegendColor] = useState<LegendColor>('blue')
  const [editingLegendId, setEditingLegendId] = useState<string | null>(null)
  const [editLegendIcon, setEditLegendIcon] = useState('')
  const [editLegendLabel, setEditLegendLabel] = useState('')
  const [editLegendColor, setEditLegendColor] = useState<LegendColor>('blue')

  // Sync settings form when adminTenant changes
  useEffect(() => {
    if (!adminTenant) return
    const s = adminTenant.settings
    setSlotList(s.time_slots?.length ? s.time_slots : [])
    setSettingsName(adminTenant.name)
    setSettingsTitle(s.title ?? '')
    setSettingsTheme(s.theme_color ?? '')
    setSlotLabels(s.slot_labels ?? {})
    setLegendItems(s.legend_items ?? [])
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
    return <div className="min-h-screen flex items-center justify-center text-gray-400">로딩 중...</div>
  }

  // Access control: super admin, current tenant admin, or admin of any org
  const canAdmin =
    profile?.is_super_admin ||
    memberships.some(m => m.role === 'admin')

  if (!profile || !canAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <p className="text-gray-500 dark:text-gray-400 mb-4">관리자 권한이 필요합니다.</p>
          <button onClick={() => navigate('/')} className="text-blue-600 dark:text-blue-400 hover:underline text-sm">← 메인으로 돌아가기</button>
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
    msg(`${directForm.name} (${directForm.email}) 계정이 생성되고 조직에 추가됐습니다.`)
    setDirectForm({ email: '', name: '', password: '', roleId: '' })
    setShowDirectCreate(false)
  }

  async function handleAddRole(e: React.FormEvent) {
    e.preventDefault()
    if (!newRoleName.trim()) return
    const err = await addRole(newRoleName.trim(), newRoleSplitCell, newRoleRequiresCustomerInfo)
    if (err) { msg(err, true); return }
    setNewRoleName('')
    setNewRoleSplitCell(false)
    setNewRoleRequiresCustomerInfo(false)
  }

  async function handleDateSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!dateForm.date) { msg('날짜를 선택해주세요.', true); return }
    setSaving(true)
    const isHoliday = dateForm.type === 'holiday'
    const err = await addDateOverride(dateForm.date, !isHoliday, isHoliday, dateForm.label || null)
    setSaving(false)
    if (err) { msg(err, true); return }
    msg('저장되었습니다.')
    setDateForm({ date: '', type: 'holiday', label: '' })
  }

  function handleAddSlot() {
    if (slotEnd <= slotStart) { msg('종료 시간은 시작 시간보다 커야 합니다.', true); return }
    const slot = buildSlot(slotStart, slotEnd)
    if (slotList.includes(slot)) { msg('이미 등록된 슬롯입니다.', true); return }
    setSlotList(prev => [...prev, slot].sort((a, b) => parseFloat(a) - parseFloat(b)))
  }

  async function handleSettingsSave(e: React.FormEvent) {
    e.preventDefault()
    if (!adminTenant) return
    if (slotList.length === 0) { msg('슬롯을 하나 이상 등록해야 합니다.', true); return }
    setSaving(true)
    const hasHalf = slotList.some(s => s.includes('.'))
    const [nameErr, settingsErr, rulesErr] = await Promise.all([
      updateTenantName(adminTenant.id, settingsName),
      updateTenantSettings(adminTenant.id, {
        title: settingsTitle,
        theme_color: settingsTheme || undefined,
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
        name: settingsName,
        settings: {
          ...adminTenant.settings,
          title: settingsTitle,
          time_slots: slotList,
          theme_color: settingsTheme || undefined,
          slot_interval_minutes: hasHalf ? 30 : 60,
          slot_labels: slotLabels,
          legend_items: legendItems,
        },
      }
      setAdminTenant(updated)
      if (adminTenant.id === tenant?.id) updateCurrentTenant(updated)
    }
  }

  const inputCls = 'border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400'

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Sticky header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3 flex-wrap">
            <button onClick={() => navigate('/')} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-sm shrink-0">← 뒤로</button>
            <h1 className="text-base font-bold text-gray-900 dark:text-white shrink-0">관리자 대시보드</h1>
            {/* Org selector */}
            {availableTenants.length > 1 ? (
              <select
                value={adminTenant?.id ?? ''}
                onChange={e => {
                  const t = availableTenants.find(t => t.id === e.target.value)
                  if (t) setAdminTenant(t)
                }}
                className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1 dark:bg-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                {availableTenants.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            ) : (
              <span className="text-sm text-gray-500 dark:text-gray-400">· {adminTenant?.name}</span>
            )}
          </div>
          <span className="text-sm text-gray-500 dark:text-gray-400">{profile.name}</span>
        </div>
        <div className="max-w-5xl mx-auto px-4 border-t dark:border-gray-700 flex overflow-x-auto">
          {(Object.keys(TAB_LABELS) as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`shrink-0 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                tab === t ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
              }`}>
              {TAB_LABELS[t]}
            </button>
          ))}
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
          <div className="text-center py-16 text-gray-400">관리할 조직을 선택해 주세요.</div>
        ) : loading ? (
          <div className="text-center py-16 text-gray-400">로딩 중...</div>
        ) : (
          <>
            {/* ── 회원 관리 ── */}
            {tab === 'members' && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider font-semibold">회원 ({members.length}명)</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setShowDirectCreate(v => !v); setShowAddMember(false) }}
                      className="px-3 py-1.5 text-xs font-medium border border-orange-400 text-orange-600 rounded-lg hover:bg-orange-50 dark:hover:bg-orange-900/20"
                    >
                      + 직접 등록
                    </button>
                    <button
                      onClick={() => { setShowAddMember(v => !v); setShowDirectCreate(false) }}
                      className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      + 회원 추가
                    </button>
                  </div>
                </div>

                {showDirectCreate && (
                  <form onSubmit={handleDirectCreate} className="mb-4 p-4 bg-white dark:bg-gray-800 rounded-xl shadow space-y-3">
                    <p className="text-xs font-semibold text-orange-600 dark:text-orange-400">
                      직접 등록 — 이메일 인증 없이 계정을 생성하고 이 조직에 자동으로 추가합니다
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">이름 *</label>
                        <input type="text" required value={directForm.name}
                          onChange={e => setDirectForm(p => ({ ...p, name: e.target.value }))}
                          placeholder="홍길동" className={inputCls + ' w-full'} />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">이메일 *</label>
                        <input type="email" required value={directForm.email}
                          onChange={e => setDirectForm(p => ({ ...p, email: e.target.value }))}
                          placeholder="test@example.com" className={inputCls + ' w-full'} />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">비밀번호 * (6자 이상)</label>
                        <input type="password" required minLength={6} value={directForm.password}
                          onChange={e => setDirectForm(p => ({ ...p, password: e.target.value }))}
                          placeholder="••••••" className={inputCls + ' w-full'} />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">역할</label>
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
                        className="px-4 py-1.5 border border-gray-300 dark:border-gray-600 text-sm rounded-lg text-gray-500">
                        취소
                      </button>
                    </div>
                  </form>
                )}

                {showAddMember && (
                  <form onSubmit={handleAddMember} className="mb-4 p-4 bg-white dark:bg-gray-800 rounded-xl shadow flex gap-2 items-end flex-wrap">
                    <div className="flex-1 min-w-48">
                      <label className="block text-xs text-gray-500 mb-1">이메일</label>
                      <input type="email" value={addEmail} onChange={e => setAddEmail(e.target.value)}
                        placeholder="member@example.com" required className={inputCls + ' w-full'} />
                    </div>
                    <button type="submit" disabled={saving}
                      className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">
                      {saving ? '추가 중...' : '추가'}
                    </button>
                    <button type="button" onClick={() => setShowAddMember(false)}
                      className="px-4 py-1.5 border border-gray-300 dark:border-gray-600 text-sm rounded-lg text-gray-500">
                      취소
                    </button>
                  </form>
                )}

                <div className="bg-white dark:bg-gray-800 rounded-xl shadow overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-gray-700/50 border-b dark:border-gray-700">
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400">이름</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 hidden sm:table-cell">이메일</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400">역할</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400">접근권한</th>
                        <th className="px-4 py-3"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {members.map(m => (
                        <tr key={m.user_id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                          <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">
                            {m.profile?.name ?? '-'}
                            {m.user_id === profile.id && <span className="ml-1.5 text-xs text-gray-400">(나)</span>}
                          </td>
                          <td className="px-4 py-3 text-gray-500 dark:text-gray-400 hidden sm:table-cell text-xs">{m.profile?.email ?? '-'}</td>
                          <td className="px-4 py-3">
                            <select
                              value={m.role_id ?? ''}
                              onChange={async e => {
                                const err = await updateMemberTenantRole(m.user_id, e.target.value || null)
                                if (err) msg(err, true)
                              }}
                              className="text-xs border border-gray-300 dark:border-gray-600 rounded px-1.5 py-1 dark:bg-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-400"
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
                                className="text-xs border border-gray-300 dark:border-gray-600 rounded px-1.5 py-1 dark:bg-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-400"
                              >
                                <option value="member">멤버</option>
                                <option value="admin">관리자</option>
                              </select>
                            ) : (
                              <span className="text-xs text-gray-400">{m.role === 'admin' ? '관리자' : '멤버'}</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {m.user_id !== profile.id && (
                              <button
                                onClick={async () => {
                                  if (!confirm(`${m.profile?.name} 회원을 삭제할까요?`)) return
                                  const err = await removeMember(m.user_id)
                                  if (err) msg(err, true)
                                }}
                                className="px-2 py-1 text-xs text-red-600 border border-red-200 rounded hover:bg-red-50 dark:border-red-800 dark:text-red-400"
                              >
                                삭제
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── 역할 관리 ── */}
            {tab === 'roles' && (
              <div className="max-w-lg">
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider font-semibold mb-3">역할 목록</p>
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow overflow-hidden mb-4">
                  {roles.length === 0 ? (
                    <p className="text-sm text-gray-400 px-4 py-6 text-center">등록된 역할이 없습니다.</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 dark:bg-gray-700/50 border-b dark:border-gray-700">
                          <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400">역할명</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400">셀 분리</th>
                          <th className="px-4 py-3"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {roles.map(r => (
                          <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                            <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{r.name}</td>
                            <td className="px-4 py-3">
                              <button
                                onClick={async () => {
                                  const err = await updateRole(r.id, { split_cell: !r.split_cell })
                                  if (err) msg(err, true)
                                }}
                                className={`inline-flex px-2 py-0.5 rounded text-xs font-medium cursor-pointer transition-colors
                                  ${r.split_cell
                                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 hover:bg-blue-200'
                                    : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-200'}`}
                              >
                                {r.split_cell ? '분리' : '미분리'}
                              </button>
                            </td>
                            <td className="px-4 py-3">
                              <button
                                onClick={async () => {
                                  if (!confirm(`"${r.name}" 역할을 삭제할까요?`)) return
                                  const err = await deleteRole(r.id)
                                  if (err) msg(err, true)
                                }}
                                className="px-2 py-1 text-xs text-red-600 border border-red-200 rounded hover:bg-red-50 dark:border-red-800 dark:text-red-400"
                              >
                                삭제
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                <form onSubmit={handleAddRole} className="bg-white dark:bg-gray-800 rounded-xl shadow p-4 space-y-3">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">역할 추가</p>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">역할명</label>
                    <input type="text" value={newRoleName} onChange={e => setNewRoleName(e.target.value)}
                      placeholder="예: 팀장" className={inputCls + ' w-full'} required />
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={newRoleSplitCell} onChange={e => setNewRoleSplitCell(e.target.checked)}
                      className="rounded border-gray-300 text-blue-600" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">셀 분리 (역할별 별도 컬럼)</span>
                  </label>
                  <button type="submit" className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">추가</button>
                </form>
              </div>
            )}

            {/* ── 스케줄 규칙 ── */}
            {tab === 'rules' && (
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider font-semibold mb-3">요일별 운영 규칙</p>

                {/* Missing rules banner */}
                {adminTimeSlots.some(slot => !scheduleRules.some(r => r.time_slot === slot)) && (
                  <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg flex items-center justify-between gap-3">
                    <span className="text-sm text-yellow-700 dark:text-yellow-300">일부 슬롯에 규칙이 없습니다. 규칙을 생성해 주세요.</span>
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

                <div className="bg-white dark:bg-gray-800 rounded-xl shadow overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-gray-700/50 border-b dark:border-gray-700">
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400">시간</th>
                        {DAY_LABELS.map(d => (
                          <th key={d} className="px-3 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 text-center">{d}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {adminTimeSlots.map(slot => (
                        <tr key={slot}>
                          <td className="px-4 py-2.5 font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">{parseSlotLabel(slot)}</td>
                          {DAY_LABELS.map((_, dayIdx) => {
                            const rule = getRule(dayIdx, slot)
                            return (
                              <td key={dayIdx} className="px-3 py-2.5 text-center">
                                {rule ? (
                                  <button onClick={async () => {
                                    const err = await toggleScheduleRule(rule.id, rule.is_open)
                                    if (err) msg(err, true)
                                  }}
                                    className={`px-2.5 py-0.5 rounded text-xs font-medium transition-colors ${rule.is_open ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 hover:bg-green-200' : 'bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600'}`}>
                                    {rule.is_open ? '운영' : '닫힘'}
                                  </button>
                                ) : <span className="text-gray-300 dark:text-gray-600">-</span>}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">버튼 클릭 시 즉시 저장됩니다.</p>
              </div>
            )}

            {/* ── 날짜 설정 ── */}
            {tab === 'dates' && (
              <div className="space-y-6">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider font-semibold mb-3">날짜 추가</p>
                  <form onSubmit={handleDateSubmit} className="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
                    <div className="flex flex-wrap gap-3 items-end">
                      <div>
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">날짜</label>
                        <input type="date" value={dateForm.date} onChange={e => setDateForm(f => ({ ...f, date: e.target.value }))} required className={inputCls} />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">유형</label>
                        <select value={dateForm.type} onChange={e => setDateForm(f => ({ ...f, type: e.target.value as 'holiday' | 'special' }))} className={inputCls}>
                          <option value="holiday">휴관일</option>
                          <option value="special">특별 운영일</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">레이블 (선택)</label>
                        <input type="text" value={dateForm.label} onChange={e => setDateForm(f => ({ ...f, label: e.target.value }))} placeholder="예: 추석연휴" className={inputCls + ' w-36'} />
                      </div>
                      <button type="submit" disabled={saving} className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">
                        {saving ? '저장 중...' : '추가'}
                      </button>
                    </div>
                  </form>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider font-semibold mb-3">설정된 날짜 ({dateOverrides.length}건)</p>
                  {dateOverrides.length === 0 ? <p className="text-sm text-gray-400">설정된 날짜가 없습니다.</p> : (
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50 dark:bg-gray-700/50 border-b dark:border-gray-700">
                            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400">날짜</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400">유형</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400">레이블</th>
                            <th className="px-4 py-3"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                          {dateOverrides.map(d => (
                            <tr key={d.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                              <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{d.date}</td>
                              <td className="px-4 py-3">
                                <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${d.is_holiday ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'}`}>
                                  {d.is_holiday ? '휴관일' : '특별운영'}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{d.label ?? '-'}</td>
                              <td className="px-4 py-3">
                                <button onClick={async () => { const err = await deleteDateOverride(d.id); if (err) msg(err, true) }}
                                  className="px-2.5 py-1 text-xs text-red-600 border border-red-200 rounded hover:bg-red-50 dark:border-red-800 dark:text-red-400">
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
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-5 space-y-4">
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider font-semibold">기본 정보</p>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">조직명</label>
                    <input type="text" value={settingsName} onChange={e => setSettingsName(e.target.value)} className={inputCls + ' w-full'} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">페이지 타이틀</label>
                    <input type="text" value={settingsTitle} onChange={e => setSettingsTitle(e.target.value)} className={inputCls + ' w-full'} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">테마 색상 (#RRGGBB, 선택)</label>
                    <input type="text" value={settingsTheme} onChange={e => setSettingsTheme(e.target.value)} placeholder="#2563eb" className={inputCls + ' w-full'} />
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-5 space-y-4">
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider font-semibold">타임슬롯</p>

                  {/* Templates */}
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">템플릿 적용</p>
                    <div className="flex gap-2 flex-wrap">
                      {SLOT_TEMPLATES.map(t => (
                        <button key={t.label} type="button"
                          onClick={() => setSlotList(t.slots)}
                          className="px-3 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Manual add */}
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">직접 추가</p>
                    <div className="flex items-end gap-2 flex-wrap">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">시작</label>
                        <select value={slotStart} onChange={e => setSlotStart(Number(e.target.value))} className={inputCls}>
                          {START_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">종료</label>
                        <select value={slotEnd} onChange={e => setSlotEnd(Number(e.target.value))} className={inputCls}>
                          {END_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </div>
                      <button type="button" onClick={handleAddSlot}
                        className="px-3 py-1.5 text-sm border border-blue-500 text-blue-600 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20">
                        + 추가
                      </button>
                    </div>
                  </div>

                  {slotList.length === 0 ? (
                    <p className="text-xs text-gray-400">등록된 슬롯이 없습니다.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {slotList.map(slot => (
                        <li key={slot} className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                          <span className="text-sm text-gray-700 dark:text-gray-300 w-32 shrink-0">{parseSlotLabel(slot)}</span>
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
                            className="flex-1 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
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

                <button type="submit" disabled={saving}
                  className="px-5 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">
                  {saving ? '저장 중...' : '저장'}
                </button>
              </form>
            )}

            {/* ── 범례 관리 ── */}
            {tab === 'legend' && (
              <div className="max-w-lg space-y-4">
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider font-semibold">
                  범례 항목 ({legendItems.length}개) — 추가/삭제 즉시 저장됩니다
                </p>

                {legendItems.length === 0 && (
                  <p className="text-xs text-gray-400">항목이 없으면 기본 범례가 표시됩니다.</p>
                )}

                <ul className="space-y-2">
                  {legendItems.map(item => {
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
                              className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-40 shrink-0">
                              저장
                            </button>
                            <button type="button" onClick={() => setEditingLegendId(null)}
                              className="px-3 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700 shrink-0">
                              취소
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className={`text-[11px] font-bold ${s.icon}`}>{item.icon}</span>
                            <span className="text-xs text-[var(--color-text-secondary)] font-medium flex-1">{item.label}</span>
                            <button type="button" onClick={() => startEditLegend(item)}
                              className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700 shrink-0">
                              수정
                            </button>
                            <button type="button" onClick={() => removeLegendItem(item.id)}
                              className="px-2 py-1 text-xs text-red-600 border border-red-200 rounded hover:bg-red-50 dark:border-red-800 dark:text-red-400 shrink-0">
                              삭제
                            </button>
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ul>

                <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4 space-y-3">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">새 항목 추가</p>
                  <div className="flex gap-2 flex-wrap items-end">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">아이콘</label>
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
                      <label className="block text-xs text-gray-500 mb-1">레이블</label>
                      <input
                        type="text"
                        value={newLegendLabel}
                        onChange={e => setNewLegendLabel(e.target.value)}
                        placeholder="햇님타임 (10~18시)"
                        className={inputCls + ' w-full'}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">색상</label>
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
                      className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40"
                    >
                      + 추가
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
