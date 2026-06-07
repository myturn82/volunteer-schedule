import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useTenant } from '../contexts/TenantContext'
import { SlotEditor } from '../components/shared/SlotEditor'
import { PLAN_LABELS, PLAN_LIMITS } from '../types'
import type { Tenant, TenantMode, PlanType } from '../types'

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
  const { profile, myCustomer, loading: authLoading, signOut, deleteAccount } = useAuth()
  const { setTenant, reloadMemberships } = useTenant()
  const navigate = useNavigate()

  const [tenants, setTenants]     = useState<Tenant[]>([])
  const [totalUsers, setTotalUsers] = useState(0)
  const [loading, setLoading]     = useState(true)
  const [message, setMessage]     = useState('')

  const [showWithdrawModal, setShowWithdrawModal] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm]             = useState<CreateForm>(EMPTY_FORM)
  const [createSlots, setCreateSlots] = useState<string[]>(['09-12', '13-14', '14-16', '16-18', '20-22'])
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
        const { count } = await supabase
          .from('tenant_members')
          .select('*', { count: 'exact', head: true })
          .in('tenant_id', list.map(t => t.id))
          .eq('is_approved', true)
        setTotalUsers(count ?? 0)
      }
      setLoading(false)
    }
    load()
  }, [myCustomer])

  const createTenant = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!myCustomer) return
    const plan = myCustomer.plan as PlanType
    const limits = PLAN_LIMITS[plan]
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
    const hasHalf = createSlots.some(s => s.includes('.'))
    const { data, error } = await supabase
      .from('tenants')
      .insert({
        slug: slugTrimmed,
        name: form.name.trim(),
        business_type: form.business_type.trim() || null,
        customer_id: myCustomer.id,
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
      setMessage(`오류: ${error.message}`)
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
  }, [form, createSlots, myCustomer, tenants.length, profile])

  if (authLoading || loading) {
    return <div className="min-h-screen flex items-center justify-center text-[var(--color-text-secondary)]">로딩 중...</div>
  }

  if (!myCustomer) return null

  const plan = myCustomer.plan as PlanType
  const limits = PLAN_LIMITS[plan]
  const atOrgLimit = tenants.length >= limits.maxOrgs
  const atUserLimit = totalUsers >= limits.maxUsers

  const inputCls = 'w-full px-3 py-2 rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-primary)]/30 focus:border-[var(--color-brand-primary)]'

  return (
    <>
    <div className="min-h-screen bg-[var(--color-bg)]">
      <div className="max-w-[820px] mx-auto" style={{ padding: 'clamp(16px,3vw,30px) clamp(14px,4vw,26px) 90px' }}>

        {/* Topbar */}
        <div className="flex items-center gap-[14px] mb-[clamp(18px,3vw,26px)]">
          <h1 className="m-0 text-[clamp(20px,5vw,26px)] font-extrabold tracking-[-0.8px]">
            {myCustomer.name}
          </h1>
          <span className="text-xs font-bold px-3 py-1 rounded-full" style={{ background: 'oklch(0.95 0.045 28)', color: 'oklch(0.45 0.14 28)' }}>
            {PLAN_LABELS[plan]}
          </span>
          <button onClick={signOut} className="ml-auto text-[13px] font-semibold text-[var(--color-text-muted)] px-3 py-2 rounded-[10px] hover:bg-[var(--color-surface)] transition-colors">
            로그아웃
          </button>
          <button onClick={() => setShowWithdrawModal(true)} className="text-[12px] font-medium text-red-400 hover:text-red-500 px-2 py-2 rounded-[10px] hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors">
            회원탈퇴
          </button>
        </div>

        {/* Plan usage stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-4">
            <p className="text-xs text-[var(--color-text-muted)] mb-1">조직</p>
            <p className={`text-xl font-bold ${atOrgLimit ? 'text-red-500' : 'text-[var(--color-text-primary)]'}`}>
              {tenants.length}
              <span className="text-sm font-normal text-[var(--color-text-muted)] ml-1">/ {limits.maxOrgs === Infinity ? '무제한' : limits.maxOrgs}</span>
            </p>
          </div>
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-4">
            <p className="text-xs text-[var(--color-text-muted)] mb-1">회원</p>
            <p className={`text-xl font-bold ${atUserLimit ? 'text-red-500' : 'text-[var(--color-text-primary)]'}`}>
              {totalUsers}
              <span className="text-sm font-normal text-[var(--color-text-muted)] ml-1">/ {limits.maxUsers === Infinity ? '무제한' : limits.maxUsers}</span>
            </p>
          </div>
          <div className="col-span-2 sm:col-span-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-4 flex flex-col justify-between">
            <p className="text-xs text-[var(--color-text-muted)] mb-2">플랜 업그레이드</p>
            <a href="mailto:support@example.com?subject=플랜 업그레이드 문의"
              className="text-xs font-semibold text-[var(--color-brand-primary)] hover:underline">
              업그레이드 문의 →
            </a>
          </div>
        </div>

        {message && (
          <div className={`mb-4 p-3 rounded-xl text-sm ${message.startsWith('오류') || message.includes('도달') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
            {message}
          </div>
        )}

        {/* Org list header */}
        <div className="flex items-center gap-3 mb-4">
          <h2 className="m-0 text-[16px] font-bold tracking-[-0.3px] text-[var(--color-text-secondary)]">조직 목록</h2>
          <button
            onClick={() => { if (atOrgLimit) { setMessage(`현재 플랜(${PLAN_LABELS[plan]})의 최대 조직 수(${limits.maxOrgs}개)에 도달했습니다.`); return } setShowCreate(v => !v) }}
            disabled={atOrgLimit}
            title={atOrgLimit ? `플랜 한도 초과 (최대 ${limits.maxOrgs}개)` : '새 조직 추가'}
            className="ml-auto inline-flex items-center justify-center gap-[6px] h-[40px] px-[17px] rounded-[11px] text-[13.5px] font-bold text-white transition-colors hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: 'var(--color-brand-primary)' }}
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
                { key: 'slug',          label: 'Slug (소문자+하이픈)', placeholder: 'my-org',    required: true  },
                { key: 'name',          label: '조직명',               placeholder: '홍길동 미용실', required: true  },
                { key: 'business_type', label: '업종 (선택)',           placeholder: 'salon'                    },
                { key: 'title',         label: '페이지 타이틀 (선택)',  placeholder: '스케줄'                    },
                { key: 'theme_color',   label: '테마 색상 (선택)',      placeholder: '#2563eb'                   },
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

        {/* Org cards */}
        <ul className="flex flex-col gap-3">
          {tenants.length === 0 && !showCreate && (
            <li className="text-center py-12 text-[var(--color-text-secondary)] text-sm">
              조직이 없습니다. "+ 새 조직" 버튼으로 첫 조직을 만들어보세요.
            </li>
          )}
          {tenants.map(t => (
            <li
              key={t.id}
              className={`flex flex-col sm:flex-row sm:items-center gap-3 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[22px] shadow-[var(--shadow-sm)] transition-all hover:-translate-y-px hover:shadow-[var(--shadow-md)] hover:border-[var(--color-border-strong)] ${t.is_active === false ? 'opacity-60' : ''}`}
              style={{ padding: '16px clamp(16px,3vw,22px)' }}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-[16px] font-bold tracking-[-0.4px]">{t.name}</span>
                  <span className="text-[12px] font-mono text-[var(--color-text-muted)]">{t.slug}</span>
                  {t.is_active === false && (
                    <span className="text-[11px] font-semibold px-[7px] py-[2px] rounded-md bg-amber-100 text-amber-700">비활성</span>
                  )}
                </div>
                {t.business_type && (
                  <span className="mt-1 inline-block text-[12px] text-[var(--color-text-muted)]">{t.business_type}</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setTenant(t, 'admin'); navigate('/schedule') }}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center h-[38px] px-4 rounded-[9px] text-[13px] font-semibold border border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-secondary)] transition-colors"
                >
                  스케줄
                </button>
                <button
                  onClick={() => { setTenant(t, 'admin'); navigate('/admin') }}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center h-[38px] px-4 rounded-[9px] text-[13px] font-semibold text-white hover:opacity-90 transition-colors"
                  style={{ background: 'var(--color-brand-primary)' }}
                >
                  관리
                </button>
              </div>
            </li>
          ))}
        </ul>

      </div>
    </div>

    {/* 회원탈퇴 확인 모달 */}
    {showWithdrawModal && (
      <>
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(20,23,28,0.45)', backdropFilter: 'blur(4px)' }} onClick={() => setShowWithdrawModal(false)} />
        <div style={{ position: 'fixed', inset: 0, zIndex: 101, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: 'var(--color-surface, #fff)', border: '1px solid rgba(20,23,28,0.09)', borderRadius: 18, padding: '24px 24px 20px', width: '100%', maxWidth: 340, boxShadow: '0 22px 60px -28px rgba(20,23,28,0.30)', fontFamily: 'inherit' }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text-primary, #14171C)', margin: '0 0 8px' }}>계정을 삭제하시겠어요?</h2>
            <p style={{ fontSize: 13, color: 'var(--color-text-secondary, #6B7280)', lineHeight: 1.6, margin: '0 0 20px' }}>
              서비스 계정({myCustomer?.name})과 모든 데이터가 영구 삭제됩니다. 이 작업은 되돌릴 수 없습니다.
            </p>
            <button
              onClick={async () => {
                setShowWithdrawModal(false)
                const err = await deleteAccount()
                if (err) alert(err)
              }}
              style={{ width: '100%', padding: '12px 16px', textAlign: 'left', borderRadius: 12, border: '1px solid oklch(0.88 0.06 25)', background: 'oklch(0.98 0.02 25)', cursor: 'pointer', fontFamily: 'inherit', marginBottom: 8 }}
            >
              <div style={{ fontSize: 13.5, fontWeight: 600, color: 'oklch(0.45 0.15 25)' }}>전체 계정 삭제</div>
              <div style={{ fontSize: 12, color: 'oklch(0.60 0.10 25)', marginTop: 2 }}>계정과 모든 조직 데이터를 완전히 삭제합니다.</div>
            </button>
            <button
              onClick={() => setShowWithdrawModal(false)}
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
