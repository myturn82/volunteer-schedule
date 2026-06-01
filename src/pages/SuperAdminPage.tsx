import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { buildSlot, parseSlotLabel, SLOT_TEMPLATES } from '../utils/timeSlots'
import type { Tenant, TenantMode } from '../types'

// ─── Time select helpers ───────────────────────────────────────────────────────

function makeTimeOption(halfHours: number) {
  const h = Math.floor(halfHours / 2)
  const m = halfHours % 2 === 0 ? '00' : '30'
  return { value: halfHours / 2, label: `${h}:${m}` }
}

const START_OPTIONS = Array.from({ length: 48 }, (_, i) => makeTimeOption(i))      // 0:00–23:30
const END_OPTIONS   = Array.from({ length: 48 }, (_, i) => makeTimeOption(i + 1))  // 0:30–24:00

// ─── SlotEditor ───────────────────────────────────────────────────────────────

interface SlotEditorProps {
  slots: string[]
  onChange: (slots: string[]) => void
}

function SlotEditor({ slots, onChange }: SlotEditorProps) {
  const [start, setStart] = useState(10)
  const [end, setEnd]     = useState(11)
  const [msg, setMsg]     = useState('')

  function applyTemplate(templateSlots: string[]) {
    setMsg('')
    onChange(templateSlots)
  }

  function handleAdd() {
    if (end <= start) { setMsg('종료 시간은 시작 시간보다 커야 합니다.'); return }
    const slot = buildSlot(start, end)
    if (slots.includes(slot)) { setMsg('이미 등록된 슬롯입니다.'); return }
    setMsg('')
    onChange([...slots, slot].sort((a, b) => parseFloat(a) - parseFloat(b)))
  }

  const selectCls = 'px-2 py-1.5 rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-primary)]/30 focus:border-[var(--color-brand-primary)]'

  return (
    <div className="space-y-3">
      {/* Template buttons */}
      <div>
        <p className="text-xs text-[var(--color-text-secondary)] font-medium mb-2">템플릿 적용</p>
        <div className="flex gap-2 flex-wrap">
          {SLOT_TEMPLATES.map(t => (
            <button
              key={t.label}
              type="button"
              onClick={() => applyTemplate(t.slots)}
              className="px-3 py-1.5 text-xs rounded-xl border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-brand-primary)] hover:text-[var(--color-brand-primary)] hover:bg-[var(--color-surface-hover)] transition-colors"
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Manual add */}
      <div>
        <p className="text-xs text-[var(--color-text-secondary)] font-medium mb-2">직접 추가</p>
        <div className="flex items-end gap-2 flex-wrap">
          <div>
            <label className="block text-xs text-[var(--color-text-secondary)] mb-1">시작</label>
            <select value={start} onChange={e => setStart(Number(e.target.value))} className={selectCls}>
              {START_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-[var(--color-text-secondary)] mb-1">종료</label>
            <select value={end} onChange={e => setEnd(Number(e.target.value))} className={selectCls}>
              {END_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={handleAdd}
            className="px-3 py-1.5 text-sm border border-[var(--color-brand-primary)] text-[var(--color-brand-primary)] rounded-xl hover:bg-[var(--color-surface-hover)]"
          >
            + 추가
          </button>
        </div>
        {msg && <p className="text-xs text-red-500 mt-1">{msg}</p>}
      </div>

      {/* Slot list */}
      {slots.length === 0 ? (
        <p className="text-xs text-[var(--color-text-secondary)]">슬롯 없음 — 템플릿을 적용하거나 직접 추가하세요.</p>
      ) : (
        <ul className="space-y-1">
          {slots.map(slot => (
            <li key={slot} className="flex items-center justify-between px-3 py-1.5 bg-[var(--color-surface-secondary)] rounded-xl">
              <span className="text-sm text-[var(--color-text-primary)]">{parseSlotLabel(slot)}</span>
              <button
                type="button"
                onClick={() => onChange(slots.filter(s => s !== slot))}
                className="text-xs text-red-500 hover:text-red-700 ml-3"
              >
                삭제
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ─── Create form ──────────────────────────────────────────────────────────────

interface CreateForm {
  slug: string
  name: string
  business_type: string
  title: string
  theme_color: string
  tenant_mode: TenantMode
}

const EMPTY_FORM: CreateForm = { slug: '', name: '', business_type: '', title: '', theme_color: '', tenant_mode: '회원공유' }
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

function displayMode(raw: string | undefined): TenantMode {
  if (raw === '회원선택') return '회원공유'
  if (raw === '직접입력') return '비회원'
  return (raw as TenantMode) ?? '회원공유'
}

// ─── SuperAdminPage ───────────────────────────────────────────────────────────

export function SuperAdminPage() {
  const { profile, loading: authLoading } = useAuth()
  const navigate = useNavigate()

  const [tenants, setTenants]       = useState<Tenant[]>([])
  const [loading, setLoading]       = useState(true)
  const [message, setMessage]       = useState('')

  // Create form state
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm]             = useState<CreateForm>(EMPTY_FORM)
  const [createSlots, setCreateSlots] = useState<string[]>(['10-12', '13-14', '14-16', '16-18', '20-22'])
  const [saving, setSaving]         = useState(false)

  // Edit state
  const [editingId, setEditingId]   = useState<string | null>(null)
  const [editSlots, setEditSlots]   = useState<string[]>([])
  const [editSaving, setEditSaving] = useState(false)
  const [modeSaving, setModeSaving] = useState(false)

  // Name edit state
  const [editingNameId, setEditingNameId] = useState<string | null>(null)
  const [editName, setEditName]           = useState('')
  const [nameSaving, setNameSaving]       = useState(false)
  const [deletingSaving, setDeletingSaving] = useState(false)

  // Slug edit state
  const [editingSlugId, setEditingSlugId] = useState<string | null>(null)
  const [editSlug, setEditSlug]           = useState('')
  const [slugSaving, setSlugSaving]       = useState(false)

  // Pending admin approvals
  const [pendingAdmins, setPendingAdmins] = useState<import('../types').Profile[]>([])

  useEffect(() => {
    if (!authLoading && (!profile || !profile.is_super_admin)) navigate('/')
  }, [profile, authLoading, navigate])

  useEffect(() => {
    if (!profile?.is_super_admin) {
      setLoading(false)
      return
    }
    Promise.all([
      supabase.from('tenants').select('*').order('created_at'),
      supabase
        .from('tenant_members')
        .select('*, profile:profiles!inner(*)')
        .eq('is_approved', false)
        .eq('profiles.is_super_admin', true),
    ]).then(([tenantsRes, pendingRes]) => {
      if (tenantsRes.error) setMessage(`테넌트 로드 오류: ${tenantsRes.error.message}`)
      setTenants(tenantsRes.data ?? [])
      const admins = (pendingRes.data ?? [])
        .map((m: { profile: import('../types').Profile }) => m.profile)
        .filter(Boolean)
      // 중복 제거 (같은 유저가 여러 조직에 pending일 수 있음)
      const seen = new Set<string>()
      setPendingAdmins(admins.filter(p => { if (seen.has(p.id)) return false; seen.add(p.id); return true }))
      setLoading(false)
    })
  }, [profile])

  function startEdit(tenant: Tenant) {
    setEditingId(tenant.id)
    setEditSlots(tenant.settings?.time_slots ?? [])
    setMessage('')
  }

  async function saveEdit(tenant: Tenant) {
    if (editSlots.length === 0) { setMessage('슬롯을 하나 이상 등록해야 합니다.'); return }
    setEditSaving(true)
    setMessage('')
    const hasHalf = editSlots.some(s => s.includes('.'))
    const { data, error } = await supabase
      .from('tenants')
      .update({
        settings: {
          ...tenant.settings,
          time_slots: editSlots,
          slot_interval_minutes: hasHalf ? 30 : 60,
        },
      })
      .eq('id', tenant.id)
      .select()
      .single()
    if (error) {
      setMessage(`오류: ${error.message}`)
    } else if (data) {
      setTenants(prev => prev.map(t => t.id === tenant.id ? data : t))
      setEditingId(null)
      setMessage('슬롯이 저장됐습니다.')
    }
    setEditSaving(false)
  }

  async function saveName(tenant: Tenant) {
    if (!editName.trim()) return
    setNameSaving(true)
    const { data, error } = await supabase
      .from('tenants')
      .update({ name: editName.trim(), updated_at: new Date().toISOString() })
      .eq('id', tenant.id)
      .select()
      .single()
    if (error) {
      setMessage(`오류: ${error.message}`)
    } else if (data) {
      setTenants(prev => prev.map(t => t.id === tenant.id ? data : t))
      setEditingNameId(null)
      setMessage('조직명이 수정됐습니다.')
    }
    setNameSaving(false)
  }

  async function saveSlug(tenant: Tenant) {
    const slug = editSlug.trim()
    if (!slug) return
    if (!SLUG_RE.test(slug)) { setMessage('오류: Slug는 소문자 영문·숫자와 하이픈(-)만 사용할 수 있습니다.'); return }
    if (tenants.some(t => t.id !== tenant.id && t.slug === slug)) { setMessage('오류: 이미 사용 중인 Slug입니다.'); return }
    setSlugSaving(true)
    const { data, error } = await supabase
      .from('tenants')
      .update({ slug, updated_at: new Date().toISOString() })
      .eq('id', tenant.id)
      .select()
      .single()
    if (error) {
      setMessage(`오류: ${error.message}`)
    } else if (data) {
      setTenants(prev => prev.map(t => t.id === tenant.id ? data : t))
      setEditingSlugId(null)
      setMessage('Slug가 수정됐습니다.')
    }
    setSlugSaving(false)
  }

  async function deleteTenant(tenant: Tenant) {
    if (!window.confirm(`"${tenant.name}" 조직을 삭제하시겠습니까?\n\n모든 데이터(배정·규칙·멤버)가 함께 삭제됩니다.`)) return
    setDeletingSaving(true)
    const { error } = await supabase.from('tenants').delete().eq('id', tenant.id)
    if (error) {
      setMessage(`오류: ${error.message}`)
    } else {
      setTenants(prev => prev.filter(t => t.id !== tenant.id))
      setMessage('조직이 삭제됐습니다.')
    }
    setDeletingSaving(false)
  }

  const createTenant = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    const slugTrimmed = form.slug.trim()
    if (!SLUG_RE.test(slugTrimmed)) {
      setMessage('오류: Slug는 소문자 영문·숫자와 하이픈(-)만 사용할 수 있습니다. (예: my-org)')
      return
    }
    const duplicate = tenants.find(t => t.slug === slugTrimmed)
    if (duplicate) {
      setMessage('오류: 이미 사용 중인 Slug입니다.')
      return
    }
    const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/
    if (form.theme_color && !HEX_COLOR_RE.test(form.theme_color.trim())) {
      setMessage('오류: 테마 색상은 #RRGGBB 형식으로 입력해주세요. (예: #2563eb)')
      return
    }
    if (createSlots.length === 0) { setMessage('슬롯을 하나 이상 등록해야 합니다.'); return }
    setSaving(true)
    setMessage('')
    const hasHalf = createSlots.some(s => s.includes('.'))
    const { data, error } = await supabase
      .from('tenants')
      .insert({
        slug: slugTrimmed,
        name: form.name.trim(),
        business_type: form.business_type.trim() || null,
        settings: {
          title: form.title.trim() || form.name.trim(),
          theme_color: form.theme_color.trim() || undefined,
          time_slots: createSlots,
          open_from: '00:00',
          open_to: '24:00',
          slot_interval_minutes: hasHalf ? 30 : 60,
          timezone: 'Asia/Seoul',
          locale: 'ko-KR',
          tenant_mode: form.tenant_mode,
        },
      })
      .select()
      .single()
    if (error) {
      setMessage(`오류: ${error.message}`)
    } else if (data) {
      // Create initial schedule_rules for all 7 days × all slots (is_open: true)
      const ruleRows = [0, 1, 2, 3, 4, 5, 6].flatMap(day =>
        createSlots.map(slot => ({ tenant_id: data.id, day_of_week: day, time_slot: slot, is_open: true }))
      )
      await supabase.from('schedule_rules').insert(ruleRows)

      setTenants(prev => [...prev, data])
      setShowCreate(false)
      setForm(EMPTY_FORM)
      setCreateSlots(['10-12', '13-14', '14-16', '16-18', '20-22'])
      setMessage('조직이 생성됐습니다.')
    }
    setSaving(false)
  }, [form, createSlots])

  if (authLoading || loading) {
    return <div className="min-h-screen flex items-center justify-center text-[var(--color-text-secondary)]">로딩 중...</div>
  }

  if (!profile?.is_super_admin) return null

  const inputCls = 'w-full px-3 py-2 rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-primary)]/30 focus:border-[var(--color-brand-primary)]'

  return (
    <div className="min-h-screen bg-[var(--color-bg)] p-4 sm:p-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">슈퍼관리자</h1>
          <button onClick={() => navigate('/')} className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">
            ← 돌아가기
          </button>
        </div>

        {message && (
          <div className={`mb-4 p-3 rounded-xl text-sm ${message.startsWith('오류') ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400' : 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'}`}>
            {message}
          </div>
        )}

        {/* Create button */}
        {/* ── 관리자 승인 대기 ── */}
        {pendingAdmins.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
              관리자 승인 대기
              <span className="ml-2 inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold rounded-full bg-red-500 text-white">{pendingAdmins.length}</span>
            </h2>
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[var(--color-surface-secondary)] border-b border-[var(--color-border)]">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)]">이름</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)]">이메일</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)]">가입일</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {pendingAdmins.map(p => (
                    <tr key={p.id} className="hover:bg-[var(--color-surface-hover)]">
                      <td className="px-4 py-3 font-medium text-[var(--color-text-primary)]">{p.name}</td>
                      <td className="px-4 py-3 text-[var(--color-text-muted)] text-xs">{p.email ?? '-'}</td>
                      <td className="px-4 py-3 text-[var(--color-text-muted)] text-xs">{p.created_at.slice(0, 10)}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            onClick={async () => {
                              const { error } = await supabase
                                .from('tenant_members')
                                .update({ is_approved: true })
                                .eq('user_id', p.id)
                                .eq('is_approved', false)
                              if (error) setMessage(`승인 오류: ${error.message}`)
                              else setPendingAdmins(prev => prev.filter(a => a.id !== p.id))
                            }}
                            className="px-3 py-1 text-xs font-medium rounded-lg bg-green-500 text-white hover:bg-green-600 transition-colors"
                          >
                            승인
                          </button>
                          <button
                            onClick={async () => {
                              if (!confirm(`"${p.name}"의 가입을 거절할까요? (프로필이 삭제됩니다)`)) return
                              const { error } = await supabase.from('profiles').delete().eq('id', p.id)
                              if (error) setMessage(`거절 오류: ${error.message}`)
                              else setPendingAdmins(prev => prev.filter(a => a.id !== p.id))
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
          </div>
        )}

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">조직 목록 ({tenants.length})</h2>
          <button
            onClick={() => setShowCreate(v => !v)}
            className="px-4 py-2 rounded-xl bg-[var(--color-brand-primary)] text-white text-sm font-medium hover:bg-[var(--color-brand-primary-hover)]"
          >
            + 새 조직
          </button>
        </div>

        {/* Create form */}
        {showCreate && (
          <form onSubmit={createTenant} className="mb-6 p-5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] space-y-4">
            <h3 className="font-semibold text-[var(--color-text-primary)]">새 조직 만들기</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {([
                { key: 'slug',          label: 'Slug (소문자+하이픈)', placeholder: 'my-org',       required: true,  maxLength: 50 },
                { key: 'name',          label: '조직명',               placeholder: '한서미용실',    required: true,  maxLength: 50 },
                { key: 'business_type', label: '업종 (선택)',           placeholder: 'salon / volunteer',              maxLength: 50 },
                { key: 'title',         label: '페이지 타이틀 (선택)',  placeholder: '스케줄',                         maxLength: 50 },
                { key: 'theme_color',   label: '테마 색상 (선택)',      placeholder: '#2563eb',                        maxLength: 7  },
              ] as { key: keyof CreateForm; label: string; placeholder: string; required?: boolean; maxLength?: number }[]).map(f => (
                <div key={f.key}>
                  <label className="block text-xs text-[var(--color-text-secondary)] mb-1">{f.label}</label>
                  <input
                    type="text"
                    placeholder={f.placeholder}
                    required={f.required}
                    maxLength={f.maxLength}
                    value={form[f.key]}
                    onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                    className={inputCls}
                  />
                </div>
              ))}
            </div>

            <div>
              <label className="block text-xs text-[var(--color-text-secondary)] mb-2">운영 모드</label>
              <div className="flex gap-3">
                {(['회원공유', '회원개별', '비회원'] as const).map(mode => (
                  <label key={mode} className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="tenant_mode"
                      value={mode}
                      checked={form.tenant_mode === mode}
                      onChange={() => setForm(prev => ({ ...prev, tenant_mode: mode }))}
                      className="accent-[var(--color-brand-primary)]"
                    />
                    <span className="text-sm text-[var(--color-text-secondary)]">{mode}</span>
                  </label>
                ))}
              </div>
            </div>

            <SlotEditor slots={createSlots} onChange={setCreateSlots} />

            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={saving || !form.slug || !form.name}
                className="px-4 py-2 rounded-xl bg-[var(--color-brand-primary)] text-white text-sm font-medium hover:bg-[var(--color-brand-primary-hover)] disabled:opacity-40"
              >
                {saving ? '저장 중...' : '생성'}
              </button>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 rounded-xl border border-[var(--color-border)] text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]"
              >
                취소
              </button>
            </div>
          </form>
        )}

        {/* Tenant list */}
        <ul className="space-y-2">
          {tenants.map(t => (
            <li key={t.id} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
              {/* Tenant row */}
              <div className="px-4 py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1">
                  {editingNameId === t.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        className="text-sm font-semibold px-2 py-1 rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-text-primary)] w-48 focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-primary)]/30 focus:border-[var(--color-brand-primary)]"
                        onKeyDown={e => { if (e.key === 'Enter') saveName(t); if (e.key === 'Escape') setEditingNameId(null) }}
                        autoFocus
                      />
                      <button onClick={() => saveName(t)} disabled={nameSaving}
                        className="px-2 py-1 text-xs bg-[var(--color-brand-primary)] text-white rounded-lg hover:bg-[var(--color-brand-primary-hover)] disabled:opacity-40">
                        {nameSaving ? '...' : '저장'}
                      </button>
                      <button onClick={() => setEditingNameId(null)}
                        className="px-2 py-1 text-xs border border-[var(--color-border)] text-[var(--color-text-secondary)] rounded-lg hover:bg-[var(--color-surface-hover)]">
                        취소
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setEditingNameId(t.id); setEditName(t.name); setEditingSlugId(null) }}
                      className="font-semibold text-[var(--color-text-primary)] hover:text-[var(--color-brand-primary)] text-left"
                    >
                      {t.name}
                    </button>
                  )}
                  {editingSlugId === t.id ? (
                    <span className="ml-2 inline-flex items-center gap-1">
                      <input
                        value={editSlug}
                        onChange={e => setEditSlug(e.target.value)}
                        className="text-xs font-mono px-2 py-0.5 rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-text-primary)] w-32 focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-primary)]/30 focus:border-[var(--color-brand-primary)]"
                        onKeyDown={e => { if (e.key === 'Enter') saveSlug(t); if (e.key === 'Escape') setEditingSlugId(null) }}
                        autoFocus
                      />
                      <button onClick={() => saveSlug(t)} disabled={slugSaving}
                        className="px-1.5 py-0.5 text-xs bg-[var(--color-brand-primary)] text-white rounded-lg hover:bg-[var(--color-brand-primary-hover)] disabled:opacity-40">
                        {slugSaving ? '...' : '저장'}
                      </button>
                      <button onClick={() => setEditingSlugId(null)}
                        className="px-1.5 py-0.5 text-xs border border-[var(--color-border-strong)] text-[var(--color-text-secondary)] rounded-lg hover:bg-[var(--color-surface-hover)]">취소</button>
                    </span>
                  ) : (
                    <button
                      onClick={() => { setEditingSlugId(t.id); setEditSlug(t.slug); setEditingNameId(null) }}
                      className="ml-2 text-xs text-[var(--color-text-secondary)] font-mono hover:text-[var(--color-brand-primary)] transition-colors"
                    >
                      {t.slug}
                    </button>
                  )}
                  {t.settings?.time_slots?.length ? (
                    <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                      슬롯 {t.settings.time_slots.length}개
                    </p>
                  ) : null}
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {t.business_type && <span className="text-xs text-[var(--color-text-secondary)] hidden sm:inline">{t.business_type}</span>}
                  <select
                    value={displayMode(t.settings?.tenant_mode)}
                    disabled={modeSaving}
                    onChange={async e => {
                      setModeSaving(true)
                      const newMode = e.target.value as TenantMode
                      const { data, error } = await supabase
                        .from('tenants')
                        .update({ settings: { ...t.settings, tenant_mode: newMode } })
                        .eq('id', t.id)
                        .select()
                        .single()
                      if (!error && data) setTenants(prev => prev.map(x => x.id === t.id ? data : x))
                      setModeSaving(false)
                    }}
                    className="px-2 py-1 text-xs border border-[var(--color-border)] rounded-lg bg-[var(--color-surface)] text-[var(--color-text-secondary)] disabled:opacity-40"
                  >
                    <option value="회원공유">회원공유</option>
                    <option value="회원개별">회원개별</option>
                    <option value="비회원">비회원</option>
                  </select>
                  <button
                    onClick={() => editingId === t.id ? setEditingId(null) : startEdit(t)}
                    className="px-2.5 py-1 text-xs font-medium border border-[var(--color-border)] text-[var(--color-text-secondary)] rounded-lg hover:bg-[var(--color-surface-hover)] transition-colors"
                  >
                    {editingId === t.id ? '닫기' : '슬롯'}
                  </button>
                  <button
                    onClick={() => navigate(`/admin?org=${t.id}`)}
                    className="px-2.5 py-1 text-xs font-medium bg-[var(--color-brand-primary)] text-white rounded-lg hover:bg-[var(--color-brand-primary-hover)] transition-colors"
                  >
                    관리
                  </button>
                  <button
                    disabled={deletingSaving}
                    onClick={() => deleteTenant(t)}
                    className="px-2.5 py-1 text-xs font-medium border border-red-200 text-red-500 rounded-lg hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/20 transition-colors disabled:opacity-40"
                  >
                    삭제
                  </button>
                </div>
              </div>

              {/* Inline slot editor */}
              {editingId === t.id && (
                <div className="px-4 pb-4 pt-1 border-t border-[var(--color-border)] space-y-4">
                  <SlotEditor slots={editSlots} onChange={setEditSlots} />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={editSaving}
                      onClick={() => saveEdit(t)}
                      className="px-4 py-2 rounded-xl bg-[var(--color-brand-primary)] text-white text-sm font-medium hover:bg-[var(--color-brand-primary-hover)] disabled:opacity-40"
                    >
                      {editSaving ? '저장 중...' : '저장'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="px-4 py-2 rounded-xl border border-[var(--color-border)] text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]"
                    >
                      취소
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
