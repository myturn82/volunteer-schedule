import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useTenant } from '../contexts/TenantContext'
import { SlotEditor } from '../components/shared/SlotEditor'
import { IndustryPicker } from '../components/IndustryPicker'
import { colorOf, avatarColorFor, initialsOf } from '../lib/avatarColor'
import { OrgTreeView } from '../components/superadmin/OrgTreeView'
import { OrgDiagramView } from '../components/superadmin/OrgDiagramView'
import { OrgCardsView } from '../components/superadmin/OrgCardsView'
import type { HubView } from '../components/superadmin/HubMain'
import { usePlanLimits } from '../contexts/PlanLimitsContext'
import { isValidPhone, formatPhone } from '../lib/phone'
import { PLAN_LABELS } from '../types'
import type { Tenant, TenantMode, PlanType } from '../types'
import { THEME_COLORS } from '../lib/themeColors'
import '../styles/account-hub.css'

interface CreateForm {
  slug: string
  name: string
  title: string
  business_type: string
  theme_color: string
  tenant_mode: TenantMode
}

const EMPTY_FORM: CreateForm = { slug: '', name: '', title: '', business_type: '', theme_color: '', tenant_mode: '회원공유' }
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function CustomerAdminPage() {
  const { profile, myCustomer, loading: authLoading, signOut, refreshCustomer } = useAuth()
  const { setTenant, reloadMemberships } = useTenant()
  const { planLimits } = usePlanLimits()
  const navigate = useNavigate()

  const [tenants, setTenants]     = useState<Tenant[]>([])
  const [totalUsers, setTotalUsers] = useState(0)
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({})
  const [pendingCounts, setPendingCounts] = useState<Record<string, number>>({})
  const [loading, setLoading]     = useState(true)
  const [message, setMessage]     = useState('')

  // Account Hub navigation state
  const [view, setView] = useState<HubView>('tree')
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null)

  const [editingPhone, setEditingPhone] = useState(false)
  const [editPhone, setEditPhone]       = useState('')
  const [phoneSaving, setPhoneSaving]   = useState(false)

  const [showDeletionModal, setShowDeletionModal] = useState(false)
  const [deletionPending, setDeletionPending]     = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm]             = useState<CreateForm>(EMPTY_FORM)
  const [colorOpen, setColorOpen]   = useState(false)
  const [createSlots, setCreateSlots] = useState<string[]>(['09-10', '10-11', '11-12', '12-13', '13-14', '14-15', '15-16', '16-17', '17-18'])
  const [saving, setSaving]         = useState(false)

  useEffect(() => {
    if (!authLoading && !myCustomer && !profile?.is_super_admin) navigate('/')
  }, [myCustomer, profile, authLoading, navigate])

  useEffect(() => {
    if (!myCustomer) return
    async function load() {
      const { data: tenantData } = await supabase
        .from('tenants')
        .select('*')
        .eq('customer_id', myCustomer!.id)
        .order('created_at')
      const list = (tenantData ?? []) as Tenant[]
      setTenants(list)

      if (list.length > 0) {
        const { data: memberData } = await supabase
          .from('tenant_members')
          .select('tenant_id, is_approved')
          .in('tenant_id', list.map(t => t.id))
        const approved: Record<string, number> = {}
        const pending: Record<string, number> = {}
        let approvedTotal = 0
        for (const row of memberData ?? []) {
          if (row.is_approved) { approved[row.tenant_id] = (approved[row.tenant_id] ?? 0) + 1; approvedTotal++ }
          else pending[row.tenant_id] = (pending[row.tenant_id] ?? 0) + 1
        }
        setMemberCounts(approved)
        setPendingCounts(pending)
        setTotalUsers(approvedTotal)
      }
      setLoading(false)
    }
    load()
  }, [myCustomer])

  async function requestDeletion() {
    if (!myCustomer) return
    setDeletionPending(true)
    const { error } = await supabase
      .from('customers')
      .update({ is_active: false, deletion_requested_at: new Date().toISOString() })
      .eq('id', myCustomer.id)
    if (error) {
      setMessage(`오류: ${error.message}`)
      setDeletionPending(false)
      return
    }
    await refreshCustomer()
    setShowDeletionModal(false)
    setDeletionPending(false)
  }

  async function cancelDeletion() {
    if (!myCustomer) return
    setDeletionPending(true)
    const { error } = await supabase
      .from('customers')
      .update({ is_active: true, deletion_requested_at: null })
      .eq('id', myCustomer.id)
    if (error) {
      setMessage(`오류: ${error.message}`)
      setDeletionPending(false)
      return
    }
    await refreshCustomer()
    setDeletionPending(false)
  }

  async function savePhone() {
    if (!myCustomer) return
    if (!isValidPhone(editPhone)) { setMessage('오류: 올바른 전화번호를 입력해 주세요. (예: 010-1234-5678)'); return }
    setPhoneSaving(true)
    const { error } = await supabase
      .from('customers')
      .update({ phone: editPhone.trim(), updated_at: new Date().toISOString() })
      .eq('id', myCustomer.id)
    if (error) {
      setMessage(`오류: ${error.message}`)
      setPhoneSaving(false)
      return
    }
    await refreshCustomer()
    setEditingPhone(false)
    setPhoneSaving(false)
  }

  const createTenant = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!myCustomer) return
    const plan = myCustomer.plan as PlanType
    const limits = planLimits[plan]
    if (tenants.length >= limits.maxOrgs) {
      setMessage(`현재 플랜(${PLAN_LABELS[plan]})의 최대 조직 수(${limits.maxOrgs}개)에 도달했습니다. 플랜을 업그레이드해 주세요.`)
      return
    }
    const slugTrimmed = form.slug.trim()
    if (!SLUG_RE.test(slugTrimmed)) {
      setMessage('오류: Slug는 소문자 영문·숫자와 하이픈(-)만 사용할 수 있습니다.')
      return
    }
    const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/
    if (form.theme_color && !HEX_COLOR_RE.test(form.theme_color.trim())) {
      setMessage('오류: 테마 색상은 #RRGGBB 형식으로 입력해주세요.')
      return
    }
    if (createSlots.length === 0) { setMessage('슬롯을 하나 이상 등록해야 합니다.'); return }
    setSaving(true)
    setMessage('')
    const freshCustomer = await refreshCustomer()
    const customerId = freshCustomer?.id ?? myCustomer.id
    const hasHalf = createSlots.some(s => s.includes('.'))
    const { data, error } = await supabase
      .from('tenants')
      .insert({
        slug: slugTrimmed,
        name: form.name.trim(),
        business_type: form.business_type.trim() || null,
        customer_id: customerId,
        settings: {
          title: form.title.trim() || form.name.trim(),
          theme_color: form.theme_color.trim() || undefined,
          time_slots: createSlots,
          open_from: '09:00',
          open_to: '22:00',
          slot_interval_minutes: hasHalf ? 30 : 60,
          timezone: 'Asia/Seoul',
          locale: 'ko-KR',
          tenant_mode: form.tenant_mode,
        },
      })
      .select()
      .single()
    if (error) {
      if (error.code === '23505' && error.message.includes('slug')) {
        setMessage('오류: 이미 사용 중인 Slug입니다. 다른 Slug를 입력해 주세요.')
      } else if (error.code === '23503' && error.message.includes('customer_id')) {
        setMessage('오류: 서비스 계정 정보가 올바르지 않습니다. 페이지를 새로고침 후 다시 시도해 주세요.')
      } else {
        setMessage(`오류: ${error.message}`)
      }
    } else if (data) {
      const ruleRows = [0, 1, 2, 3, 4, 5, 6].flatMap(day =>
        createSlots.map(slot => ({ tenant_id: data.id, day_of_week: day, time_slot: slot, is_open: true }))
      )
      await supabase.from('schedule_rules').insert(ruleRows)
      // 생성자를 해당 조직의 admin 멤버로 자동 등록
      if (profile?.id) {
        await supabase.from('tenant_members').insert({
          tenant_id: data.id,
          user_id: profile.id,
          role: 'admin',
          is_approved: true,
        })
      }
      setTenants(prev => [...prev, data])
      await reloadMemberships()
      setShowCreate(false)
      setForm(EMPTY_FORM)
      setCreateSlots(['09-12', '13-14', '14-16', '16-18', '20-22'])
      setMessage('조직이 생성됐습니다.')
    }
    setSaving(false)
  }, [form, createSlots, myCustomer, tenants.length, profile, refreshCustomer, reloadMemberships, planLimits])

  if (authLoading || loading) {
    return <div className="min-h-screen flex items-center justify-center text-[var(--color-text-secondary)]">로딩 중...</div>
  }

  if (!myCustomer) return null

  const isDeletionPending = !!myCustomer.deletion_requested_at

  function daysElapsed(iso: string) {
    return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  }

  const plan = myCustomer.plan as PlanType
  const limits = planLimits[plan]
  const atOrgLimit = tenants.length >= limits.maxOrgs
  const atUserLimit = totalUsers >= limits.maxUsers
  const totalSlots = tenants.reduce((sum, t) => sum + (t.settings?.time_slots?.length ?? 0), 0)
  const totalPending = tenants.reduce((sum, t) => sum + (pendingCounts[t.id] ?? 0), 0)
  const selectedTenant = tenants.find(t => t.id === selectedTenantId) ?? null

  const inputCls = 'w-full px-3 py-2 rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-primary)]/30 focus:border-[var(--color-brand-primary)]'

  const customerColor = colorOf(myCustomer.name)

  function handleSelectOrg(id: string) {
    setSelectedTenantId(prev => prev === id ? null : id)
  }

  return (
    <>
    <div className="min-h-screen bg-[var(--color-bg)]">
      <div className="max-w-[1400px] mx-auto" style={{ padding: 'clamp(16px,3vw,30px) clamp(14px,4vw,26px) 90px' }}>

        {/* Topbar */}
        <div className="flex items-center gap-[14px] mb-[clamp(18px,3vw,26px)]">
          <h1 className="m-0 text-[clamp(20px,5vw,26px)] font-extrabold tracking-[-0.8px] flex items-center gap-[10px] whitespace-nowrap min-w-0">
            <span className="hub-avatar is-lg flex-shrink-0" style={{ background: customerColor.bg, color: customerColor.fg }}>{initialsOf(myCustomer.name)}</span>
            <span className="truncate">{myCustomer.name}</span>
          </h1>
          <span className="text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap" style={{ background: 'oklch(0.95 0.045 28)', color: 'oklch(0.45 0.14 28)' }}>
            {PLAN_LABELS[plan]}
          </span>
          {!isDeletionPending && (
            <button
              onClick={() => setShowDeletionModal(true)}
              className="text-[12px] font-medium text-red-400 hover:text-red-500 px-2 py-2 rounded-[10px] hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors whitespace-nowrap"
            >
              서비스 탈퇴
            </button>
          )}
          <button onClick={signOut} className="ml-auto text-[13px] font-semibold text-[var(--color-text-muted)] px-3 py-2 rounded-[10px] hover:bg-[var(--color-surface)] transition-colors whitespace-nowrap">
            로그아웃
          </button>
        </div>

        {message && (
          <div className={`mb-4 p-3 rounded-xl text-sm ${message.startsWith('오류') || message.includes('도달') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
            {message}
          </div>
        )}

        {/* ── Account Hub ── */}
        <div className="hub">
          <div className="hub-main">
            <div className="hub-breadcrumb">
              <span>계정 허브</span>
              <span>›</span>
              <b>{myCustomer.name}</b>
            </div>

            <div className="hub-hero">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <a href="mailto:support@example.com?subject=플랜 업그레이드 문의"
                  className="text-xs font-semibold text-[var(--color-brand-primary)] hover:underline">
                  업그레이드 문의 →
                </a>
                <div className="flex items-center gap-2 flex-wrap">
                  {editingPhone ? (
                    <span className="flex items-center gap-1">
                      <input
                        value={editPhone}
                        onChange={e => setEditPhone(formatPhone(e.target.value))}
                        placeholder="010-1234-5678"
                        maxLength={13}
                        className="text-xs px-2 py-1 rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-text-primary)] w-32 focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-primary)]/30 focus:border-[var(--color-brand-primary)]"
                        onKeyDown={e => { if (e.key === 'Enter') savePhone(); if (e.key === 'Escape') setEditingPhone(false) }}
                        autoFocus
                      />
                      <button onClick={savePhone} disabled={phoneSaving}
                        className="px-1.5 py-1 text-xs bg-[var(--color-brand-primary)] text-white rounded-lg disabled:opacity-40">
                        {phoneSaving ? '...' : '저장'}
                      </button>
                      <button onClick={() => setEditingPhone(false)}
                        className="px-1.5 py-1 text-xs border border-[var(--color-border-strong)] text-[var(--color-text-secondary)] rounded-lg">취소</button>
                    </span>
                  ) : (
                    <button
                      onClick={() => { setEditingPhone(true); setEditPhone(formatPhone(myCustomer.phone ?? '')) }}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-brand-primary)] hover:border-[var(--color-brand-primary)]/40 transition-colors text-xs"
                    >
                      전화번호: {myCustomer.phone ? formatPhone(myCustomer.phone) : '미입력'}
                    </button>
                  )}
                  <span className="text-[var(--color-text-muted)] text-xs">가입일 {myCustomer.created_at.slice(0, 10)}</span>
                </div>
              </div>

              {isDeletionPending && (
                <div className="mt-4 flex items-center gap-3 bg-red-50 border border-red-200 rounded-2xl px-4 py-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <span className="font-semibold text-sm text-[var(--color-text-primary)]">탈퇴 요청 중</span>
                    <span className="ml-2 text-xs text-red-500">{daysElapsed(myCustomer.deletion_requested_at!)}일 경과</span>
                    <span className="ml-2 text-xs text-[var(--color-text-muted)]">관리자 검토 후 완전 삭제됩니다. 30일 이내 취소 가능합니다.</span>
                  </div>
                  <button
                    onClick={cancelDeletion}
                    disabled={deletionPending}
                    className="px-3 py-1.5 rounded-lg border border-red-300 bg-white text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                  >
                    {deletionPending ? '처리 중...' : '탈퇴 취소'}
                  </button>
                </div>
              )}

              <div className="hub-stats">
                <div className="hub-stat">
                  <div className={`hub-stat-value ${atOrgLimit ? 'text-red-500' : ''}`}>
                    {tenants.length}
                    <span className="text-sm font-normal text-[var(--color-text-muted)] ml-1">/ {limits.maxOrgs === Infinity ? '무제한' : limits.maxOrgs}</span>
                  </div>
                  <div className="hub-stat-label">조직</div>
                </div>
                <div className="hub-stat">
                  <div className={`hub-stat-value ${atUserLimit ? 'text-red-500' : ''}`}>
                    {totalUsers}
                    <span className="text-sm font-normal text-[var(--color-text-muted)] ml-1">/ {limits.maxUsers === Infinity ? '무제한' : limits.maxUsers}</span>
                  </div>
                  <div className="hub-stat-label">활성 멤버</div>
                </div>
                <div className="hub-stat">
                  <div className="hub-stat-value">{totalSlots}</div>
                  <div className="hub-stat-label">슬롯 합계</div>
                </div>
                <div className="hub-stat">
                  <div className="hub-stat-value">{totalPending}</div>
                  <div className="hub-stat-label">승인 대기</div>
                </div>
              </div>
            </div>

            {/* ── View switcher + create ── */}
            <div className="flex items-center gap-3 flex-wrap mb-3">
              <div className="hub-view-switch">
                <button onClick={() => setView('tree')} className={`hub-view-btn ${view === 'tree' ? 'is-active' : ''}`}>트리</button>
                <button onClick={() => setView('diagram')} className={`hub-view-btn ${view === 'diagram' ? 'is-active' : ''}`}>다이어그램</button>
                <button onClick={() => setView('cards')} className={`hub-view-btn ${view === 'cards' ? 'is-active' : ''}`}>카드</button>
              </div>
              <button
                onClick={() => {
                  if (isDeletionPending) { setMessage('탈퇴 요청 중에는 새 조직을 생성할 수 없습니다.'); return }
                  if (atOrgLimit) { setMessage(`현재 플랜(${PLAN_LABELS[plan]})의 최대 조직 수(${limits.maxOrgs}개)에 도달했습니다.`); return }
                  setShowCreate(v => !v)
                }}
                disabled={atOrgLimit || isDeletionPending}
                title={isDeletionPending ? '탈퇴 요청 중입니다' : atOrgLimit ? `플랜 한도 초과 (최대 ${limits.maxOrgs}개)` : '새 조직 추가'}
                className="ml-auto inline-flex items-center justify-center gap-[6px] h-[36px] px-[16px] rounded-[11px] text-[13px] font-bold whitespace-nowrap text-white transition-colors hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: 'var(--color-brand-primary)' }}
              >
                + 새 조직
              </button>
            </div>

            {/* ── Create form ── */}
            {showCreate && (
              <form onSubmit={createTenant} className="mb-6 p-5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] space-y-4">
                <h3 className="font-semibold text-[var(--color-text-primary)]">새 조직 만들기</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {([
                    { key: 'slug',        label: 'Slug (소문자+하이픈)', placeholder: 'my-org',    required: true  },
                    { key: 'name',        label: '조직명',               placeholder: '홍길동 미용실', required: true  },
                    { key: 'title',       label: '페이지 타이틀 (선택)',  placeholder: '스케줄'                    },
                  ] as { key: keyof CreateForm; label: string; placeholder: string; required?: boolean }[]).map(f => (
                    <div key={f.key}>
                      <label className="block text-xs text-[var(--color-text-secondary)] mb-1">{f.label}</label>
                      <input
                        type="text"
                        placeholder={f.placeholder}
                        required={f.required}
                        value={form[f.key]}
                        onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                        className={inputCls}
                      />
                    </div>
                  ))}
                  <div className="sm:col-span-2">
                    <IndustryPicker
                      value={form.business_type}
                      onChange={v => setForm(prev => ({ ...prev, business_type: v }))}
                      inputCls={inputCls}
                    />
                  </div>
                </div>

                {/* 테마 색상 스워치 피커 */}
                <div>
                  <button
                    type="button"
                    onClick={() => setColorOpen(!colorOpen)}
                    className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: colorOpen ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}>
                      <path d="M4 2l4 4-4 4" />
                    </svg>
                    <span>테마 색상 (선택)</span>
                    {form.theme_color && <span className="w-4 h-4 rounded-sm border border-[var(--color-border-strong)] inline-block" style={{ background: form.theme_color }} />}
                  </button>
                  {colorOpen && (
                    <div className="mt-2 space-y-2">
                      <div className="flex flex-wrap gap-1.5">
                        {THEME_COLORS.map(color => (
                          <button
                            key={color}
                            type="button"
                            title={color}
                            onClick={() => setForm(prev => ({ ...prev, theme_color: prev.theme_color === color ? '' : color }))}
                            className="w-7 h-7 rounded-lg border-2 transition-transform hover:scale-110 flex items-center justify-center flex-shrink-0"
                            style={{ background: color, borderColor: form.theme_color === color ? '#1f2937' : 'transparent', boxShadow: form.theme_color === color ? '0 0 0 1px #fff inset' : undefined }}
                          >
                            {form.theme_color === color && (
                              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                                <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center gap-2">
                        {form.theme_color && <span className="w-6 h-6 rounded-md border border-[var(--color-border-strong)] flex-shrink-0" style={{ background: form.theme_color }} />}
                        <input
                          type="text"
                          placeholder="직접 입력 (#2563eb)"
                          maxLength={7}
                          value={form.theme_color}
                          onChange={e => setForm(prev => ({ ...prev, theme_color: e.target.value }))}
                          className={inputCls + ' text-xs py-1.5 font-mono'}
                        />
                        {form.theme_color && (
                          <button type="button" onClick={() => setForm(prev => ({ ...prev, theme_color: '' }))} className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] flex-shrink-0">
                            초기화
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs text-[var(--color-text-secondary)] mb-2">운영 모드</label>
                  <div className="flex gap-3">
                    {(['회원공유', '회원개별', '비회원'] as const).map(mode => (
                      <label key={mode} className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="tenant_mode_ca"
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
                  <button type="submit" disabled={saving || !form.slug || !form.name}
                    className="px-4 py-2 rounded-xl bg-[var(--color-brand-primary)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-40">
                    {saving ? '저장 중...' : '생성'}
                  </button>
                  <button type="button" onClick={() => setShowCreate(false)}
                    className="px-4 py-2 rounded-xl border border-[var(--color-border)] text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]">
                    취소
                  </button>
                </div>
              </form>
            )}

            {/* ── Org views ── */}
            {view === 'tree' && (
              <OrgTreeView tenants={tenants} memberCounts={memberCounts} pendingCounts={pendingCounts} selectedOrgId={selectedTenantId} onSelect={handleSelectOrg} />
            )}
            {view === 'diagram' && (
              <OrgDiagramView customerName={myCustomer.name} tenants={tenants} memberCounts={memberCounts} pendingCounts={pendingCounts} selectedOrgId={selectedTenantId} onSelect={handleSelectOrg} />
            )}
            {view === 'cards' && (
              <OrgCardsView tenants={tenants} memberCounts={memberCounts} pendingCounts={pendingCounts} selectedOrgId={selectedTenantId} onSelect={handleSelectOrg} />
            )}
          </div>

          {/* ── Org drawer ── */}
          {selectedTenant && (
            <div className="hub-drawer-backdrop is-open" onClick={() => setSelectedTenantId(null)} />
          )}
          {selectedTenant && (() => {
            const { bg, fg } = avatarColorFor(selectedTenant.name, selectedTenant.settings?.theme_color)
            const orgDisabled = isDeletionPending || selectedTenant.is_active === false
            return (
              <aside className="hub-drawer is-open">
                <div className="flex items-start gap-3 mb-4">
                  <span className="hub-avatar is-lg" style={{ background: bg, color: fg }}>{initialsOf(selectedTenant.name)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[16px] font-extrabold tracking-[-0.3px] text-[var(--color-text-primary)] truncate m-0">{selectedTenant.name}</p>
                    <p className="text-[12px] font-medium font-mono text-[var(--color-text-muted)] mt-0.5 m-0">{selectedTenant.slug}</p>
                    {selectedTenant.business_type && <p className="text-[11.5px] text-[var(--color-text-muted)] mt-1 m-0">{selectedTenant.business_type}</p>}
                    {selectedTenant.is_active === false && <span className="hub-badge hub-badge-danger mt-1 inline-block">비활성</span>}
                  </div>
                  <button onClick={() => setSelectedTenantId(null)} className="flex-shrink-0 w-7 h-7 rounded-lg grid place-items-center text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]" title="닫기">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => { setTenant(selectedTenant, 'admin'); navigate('/schedule') }}
                    disabled={orgDisabled}
                    className="inline-flex items-center justify-center h-[36px] px-3 rounded-[9px] text-[12.5px] font-semibold border border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] shadow-[var(--shadow-xs)] hover:bg-[var(--color-surface-secondary)] hover:text-[var(--color-text-primary)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    스케줄
                  </button>
                  <button
                    onClick={() => { setTenant(selectedTenant, 'admin'); navigate('/admin') }}
                    disabled={orgDisabled}
                    className="inline-flex items-center justify-center h-[36px] px-3 rounded-[9px] text-[12.5px] font-semibold text-white transition-colors hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ background: 'var(--color-brand-primary)' }}
                  >
                    관리
                  </button>
                </div>
              </aside>
            )
          })()}
        </div>

      </div>
    </div>

    {/* 서비스 탈퇴 요청 확인 모달 */}
    {showDeletionModal && (
      <>
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(20,23,28,0.45)', backdropFilter: 'blur(4px)' }}
          onClick={() => setShowDeletionModal(false)}
        />
        <div style={{ position: 'fixed', inset: 0, zIndex: 101, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: 'var(--color-surface, #fff)', border: '1px solid rgba(20,23,28,0.09)', borderRadius: 18, padding: '24px 24px 20px', width: '100%', maxWidth: 360, boxShadow: '0 22px 60px -28px rgba(20,23,28,0.30)', fontFamily: 'inherit' }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text-primary, #14171C)', margin: '0 0 8px' }}>
              서비스 탈퇴를 요청하시겠어요?
            </h2>
            <p style={{ fontSize: 13, color: 'var(--color-text-secondary, #6B7280)', lineHeight: 1.6, margin: '0 0 20px' }}>
              요청 즉시 모든 조직이 비활성화됩니다. 관리자 검토 후 완전 삭제되며,
              <strong> 30일 이내에 취소</strong>할 수 있습니다.
            </p>
            <button
              onClick={requestDeletion}
              disabled={deletionPending}
              style={{ width: '100%', padding: '12px 16px', textAlign: 'left', borderRadius: 12, border: '1px solid oklch(0.88 0.06 25)', background: 'oklch(0.98 0.02 25)', cursor: 'pointer', fontFamily: 'inherit', marginBottom: 8, opacity: deletionPending ? 0.5 : 1 }}
            >
              <div style={{ fontSize: 13.5, fontWeight: 600, color: 'oklch(0.45 0.15 25)' }}>탈퇴 요청</div>
              <div style={{ fontSize: 12, color: 'oklch(0.60 0.10 25)', marginTop: 2 }}>
                서비스가 즉시 중단되며 관리자 검토 후 완전 삭제됩니다.
              </div>
            </button>
            <button
              onClick={() => setShowDeletionModal(false)}
              style={{ width: '100%', height: 38, fontSize: 13, color: 'var(--color-text-muted, #8A8F99)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              취소
            </button>
          </div>
        </div>
      </>
    )}
    </>
  )
}
