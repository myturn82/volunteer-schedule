import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useTenant } from '../contexts/TenantContext'
import { supabase } from '../lib/supabase'
import { ScheduleBackground } from '../components/auth/ScheduleBackground'

interface TenantRole { id: string; name: string; display_order: number }

const accent     = 'oklch(0.66 0.16 28)'
const accentSoft = 'oklch(0.95 0.04 28)'
const accentInk  = 'oklch(0.38 0.13 28)'

const selectSt: React.CSSProperties = {
  width: '100%', height: 42, padding: '0 32px 0 12px', boxSizing: 'border-box',
  background: '#fff', border: '1px solid rgba(20,23,28,0.09)',
  borderRadius: 10, fontSize: 13.5, color: '#14171C',
  outline: 'none', fontFamily: 'inherit', cursor: 'pointer',
  appearance: 'none', WebkitAppearance: 'none',
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 20 20' fill='none' stroke='%238A8F99' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M5 8l5 5 5-5'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center',
}
const labelSt: React.CSSProperties = {
  display: 'block', fontSize: 11.5, fontWeight: 600, color: '#353A44', marginBottom: 5,
}

export function PendingPage() {
  const { profile, signOut, deleteAccount } = useAuth()
  const { reloadMemberships } = useTenant()
  const [mode, setMode] = useState<'choose' | 'start-service' | 'join-org'>('choose')

  useEffect(() => {
    const stored = localStorage.getItem('vs_pending_mode')
    if (stored === 'start-service') {
      localStorage.removeItem('vs_pending_mode')
      setMode('start-service')
    } else if (stored === 'join-org') {
      localStorage.removeItem('vs_pending_mode')
      setMode('join-org')
      setShowForm(true)
    }
  }, [])

  const [customerName, setCustomerName] = useState('')
  const [customerCreating, setCustomerCreating] = useState(false)

  const [showForm, setShowForm] = useState(false)

  // join-org 단일 선택 상태
  const [allTenants, setAllTenants] = useState<{ id: string; name: string; customerId: string; customerName: string }[]>([])
  const [selCustomerId, setSelCustomerId] = useState('')
  const [selTenantId, setSelTenantId] = useState('')
  const [selTenantRoles, setSelTenantRoles] = useState<TenantRole[] | null>(null)
  const [selTenantTypeLabels, setSelTenantTypeLabels] = useState<{ volunteer: string; '50plus': string }>({ volunteer: '팀원', '50plus': '50플러스' })
  const [selRole, setSelRole] = useState<{ roleId: string | null; defaultRole: string | null } | null>(null)
  const [loadingRoles, setLoadingRoles] = useState(false)

  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showWithdrawModal, setShowWithdrawModal] = useState(false)
  const [withdrawTenantId, setWithdrawTenantId] = useState('')

  interface MyMembership { tenant_id: string; is_approved: boolean; tenant: { name: string } | null }
  const [memberships, setMemberships] = useState<MyMembership[] | null>(null)

  useEffect(() => {
    if (!profile) return
    supabase
      .from('tenant_members')
      .select('tenant_id, is_approved, tenant:tenants(name)')
      .eq('user_id', profile.id)
      .then(({ data }) => setMemberships((data ?? []) as unknown as MyMembership[]))
  }, [profile?.id])

  const pendingOrgs = (memberships ?? []).filter(m => m.is_approved === false)
  const hasPending = pendingOrgs.length > 0

  useEffect(() => {
    if (!profile) return
    const notice = localStorage.getItem('vs_notice_join_requested')
    if (notice) { localStorage.removeItem('vs_notice_join_requested'); setSubmitted(true) }
  }, [profile?.id])

  // tenants 조회 (RLS 없음) → customer_id 목록으로 customers 별도 조회
  // customers 테이블 SELECT RLS가 막으면 customerName이 공백으로 표시됨
  // → Supabase 대시보드에서 customers 테이블에 아래 정책 추가 필요:
  //   FOR SELECT TO authenticated USING (is_active = true)
  useEffect(() => {
    if (!showForm || memberships === null) return
    const mine = new Set(memberships.map(m => m.tenant_id))

    ;(async () => {
      const { data: tenantsData } = await supabase
        .from('tenants')
        .select('id, name, customer_id')
        .order('name')

      const available = (tenantsData ?? []).filter(
        (t: { id: string; customer_id: string | null }) => !mine.has(t.id) && t.customer_id
      ) as { id: string; name: string; customer_id: string }[]

      const customerIds = [...new Set(available.map(t => t.customer_id))]

      const { data: customersData } = customerIds.length > 0
        ? await supabase.from('customers').select('id, name').in('id', customerIds)
        : { data: [] as { id: string; name: string }[] }

      const customerMap = new Map((customersData ?? []).map(c => [c.id, c.name]))

      setAllTenants(
        available.map(t => ({
          id: t.id,
          name: t.name,
          customerId: t.customer_id,
          customerName: customerMap.get(t.customer_id) ?? '',
        }))
      )
    })()
  }, [showForm, memberships])

  // 서비스별 그룹 (드롭다운 옵션용) — customerName 없으면 customerId 앞 8자로 대체
  const availableCustomers = [...new Map(
    allTenants.map(t => [t.customerId, { id: t.customerId, name: t.customerName || t.customerId.slice(0, 8) }])
  ).values()].sort((a, b) => a.name.localeCompare(b.name, 'ko'))

  const customerTenants = allTenants.filter(t => t.customerId === selCustomerId)

  async function onSelectTenant(tenantId: string) {
    setSelTenantId(tenantId)
    setSelRole(null)
    setSelTenantRoles(null)
    setError(null)
    if (!tenantId) return
    setLoadingRoles(true)
    const [{ data: roles }, { data: tenantData }] = await Promise.all([
      supabase.from('tenant_roles').select('id, name, display_order').eq('tenant_id', tenantId).order('display_order'),
      supabase.from('tenants').select('settings').eq('id', tenantId).single(),
    ])
    const s = (tenantData as { settings?: { volunteer_label?: string; plus_label?: string } } | null)?.settings
    setSelTenantRoles(roles ?? [])
    setSelTenantTypeLabels({
      volunteer: s?.volunteer_label ?? '팀원',
      '50plus': s?.plus_label ?? '50플러스',
    })
    setLoadingRoles(false)
  }

  const isAdminRole = profile?.is_super_admin

  const waitMessage = hasPending
    ? isAdminRole
      ? '관리자 계정은 슈퍼관리자의 승인 후 활성화됩니다.'
      : '조직 관리자의 승인을 기다리고 있습니다.'
    : '신청할 조직을 선택해 주세요.'

  async function handleReapply() {
    if (!selTenantId) { setError('조직을 선택해주세요.'); return }
    if (selTenantRoles === null) { setError('역할 정보를 불러오는 중입니다. 잠시 후 다시 시도해주세요.'); return }

    const hasCustomRoles = selTenantRoles.length > 0
    const hasNoRoles = selTenantRoles.length === 0

    if (hasNoRoles) { setError('이 조직은 아직 활동 유형이 등록되지 않았습니다.'); return }
    if (hasCustomRoles && !selRole?.roleId) { setError('활동 유형을 선택해주세요.'); return }
    if (!hasCustomRoles && !selRole?.defaultRole) { setError('활동 유형을 선택해주세요.'); return }

    setError(null)
    setSubmitting(true)

    const isFirstRequest = (memberships?.length ?? 0) === 0

    const { error: insertErr } = await supabase
      .from('tenant_members')
      .insert({
        tenant_id: selTenantId,
        user_id: profile!.id,
        role: 'member',
        role_id: hasCustomRoles ? (selRole?.roleId ?? null) : null,
      })

    if (insertErr && insertErr.code !== '23505') {
      setSubmitting(false)
      setError(insertErr.message)
      return
    }

    // 항상 memberships 갱신 — stale 상태로 인한 중복 신청 방지
    const { data: freshMem } = await supabase
      .from('tenant_members')
      .select('tenant_id, is_approved, tenant:tenants(name)')
      .eq('user_id', profile!.id)
    setMemberships((freshMem ?? []) as unknown as MyMembership[])

    setSubmitting(false)

    if (isFirstRequest) {
      setSubmitted(true)
      setShowForm(false)
    } else {
      resetForm()
    }
  }

  function resetForm() {
    setShowForm(false)
    setAllTenants([])
    setSelCustomerId('')
    setSelTenantId('')
    setSelTenantRoles(null)
    setSelRole(null)
    setLoadingRoles(false)
    setError(null)
  }

  async function handleCreateCustomer(e: React.FormEvent) {
    e.preventDefault()
    if (!profile || !customerName.trim()) return
    setCustomerCreating(true)
    const { data, error } = await supabase
      .from('customers')
      .insert({ name: customerName.trim(), owner_user_id: profile.id, plan: 'basic' })
      .select()
      .single()
    if (error) { setError(`오류: ${error.message}`); setCustomerCreating(false); return }
    if (data) { window.location.href = '/customer-admin'; return }
    setCustomerCreating(false)
  }

  const topNavSlot = (
    <>
      <span style={{ fontSize: 13, color: '#6B7280' }}>{profile?.name}</span>
      <button className="lmp-nav-btn" onClick={signOut}>로그아웃</button>
    </>
  )

  const inputSt: React.CSSProperties = {
    width: '100%', height: 42, padding: '0 14px', boxSizing: 'border-box',
    background: '#fff', border: '1px solid rgba(20,23,28,0.09)',
    borderRadius: 10, fontSize: 13.5, color: '#14171C',
    outline: 'none', fontFamily: 'inherit',
  }
  const errBox: React.CSSProperties = {
    margin: '8px 0', padding: '10px 14px', borderRadius: 10,
    background: 'oklch(0.97 0.02 25)', border: '1px solid oklch(0.88 0.06 25)',
    color: 'oklch(0.45 0.15 25)', fontSize: 13,
  }

  // 활동유형 기본 목록
  const defaultRoles = [
    { value: 'volunteer', label: selTenantTypeLabels.volunteer },
    { value: '50plus',    label: selTenantTypeLabels['50plus'] },
    { value: 'team_leader', label: '팀장' },
  ]

  const arrowIcon = (
    <svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 10h12M11 5l5 5-5 5"/>
    </svg>
  )

  return (
    <ScheduleBackground topNavSlot={topNavSlot}>
      <style>{`
        .pending-card {
          position: relative; z-index: 5; width: 100%; max-width: 440px;
          background: #fff; border: 1px solid rgba(20,23,28,0.07); border-radius: 18px;
          padding: 28px 28px 26px; margin: auto;
          box-shadow: 0 1px 0 rgba(20,23,28,0.03), 0 22px 60px -28px rgba(20,23,28,0.22), 0 4px 14px -8px rgba(20,23,28,0.10);
          overflow-y: auto;
          max-height: calc(100dvh - 140px);
        }
        .pending-submit-btn {
          width: 100%; height: 46px; background: #14171C; color: #fff; border: 0;
          border-radius: 12px; font: inherit; font-size: 14px; font-weight: 600;
          letter-spacing: -0.2px; cursor: pointer;
          box-shadow: 0 1px 0 rgba(20,23,28,0.06), 0 8px 20px -8px rgba(20,23,28,0.30);
          display: flex; align-items: center; justify-content: center; gap: 8px;
          transition: transform .12s;
        }
        .pending-submit-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .pending-ghost-btn {
          width: 100%; height: 44px; background: #F4F1EA;
          border: 1px solid rgba(20,23,28,0.09); border-radius: 12px;
          font: inherit; font-size: 13.5px; font-weight: 600; color: #6B7280;
          cursor: pointer; display: flex; align-items: center; justify-content: center;
          transition: background .12s;
        }
        .pending-ghost-btn:hover { background: #ECE8DF; }
        .pending-choice-btn {
          width: 100%; text-align: left; padding: 14px 16px; border-radius: 14px;
          background: #fff; font: inherit; cursor: pointer; transition: all .15s;
          display: flex; flex-direction: column; gap: 3px;
        }
        @media (max-width: 540px) {
          .pending-card { max-width: 100%; padding: 20px 18px 18px; border-radius: 14px; max-height: calc(100dvh - 120px); }
        }
        @media (max-height: 620px) and (min-width: 541px) {
          .pending-card { padding: 16px 22px 14px; }
        }
      `}</style>

      <div className="pending-card">

        {/* ── 신청 완료 상태 ── */}
        {submitted ? (
          <div style={{ textAlign: 'center', padding: '20px 0 12px' }}>
            <div style={{ fontSize: 36, marginBottom: 14 }}>✅</div>
            <div style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: 11, color: accent, fontWeight: 700, marginBottom: 8, letterSpacing: '1.2px', textTransform: 'uppercase' }}>SUBMITTED</div>
            <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.6, color: '#14171C', margin: '0 0 10px' }}>신청 완료</h2>
            <p style={{ fontSize: 13.5, color: '#6B7280', lineHeight: 1.65, marginBottom: 24 }}>
              신청이 완료됐습니다.<br />관리자의 승인을 기다려 주세요.
            </p>
            <button
              onClick={() => {
                setSubmitted(false)
                setSelCustomerId('')
                setSelTenantId('')
                setSelRole(null)
                setSelTenantRoles(null)
                setError(null)
                setShowForm(true)
              }}
              className="pending-ghost-btn"
              style={{ marginBottom: 8 }}
            >
              돌아가기
            </button>
          </div>
        ) : (
          <>
            {/* eyebrow */}
            <div style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: 11, color: accent, fontWeight: 700, marginBottom: 6, letterSpacing: '1.2px', textTransform: 'uppercase' as const }}>
              {hasPending ? 'PENDING' : 'GET STARTED'}
            </div>

            <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.6, color: '#14171C', margin: '0 0 8px' }}>
              {hasPending ? '승인 대기 중' : '시작하기'}
            </h2>

            <p style={{ fontSize: 13.5, color: '#6B7280', lineHeight: 1.6, marginBottom: hasPending ? 16 : 20 }}>
              {profile?.name ? `${profile.name}님, ` : ''}{waitMessage}
            </p>

            {/* 대기 중인 조직 태그 */}
            {hasPending && pendingOrgs.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 20 }}>
                {pendingOrgs.map(m => (
                  <span key={m.tenant_id} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600,
                    background: 'oklch(0.97 0.05 70)', color: 'oklch(0.50 0.14 55)',
                    border: '1px solid oklch(0.88 0.07 70)',
                  }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'oklch(0.72 0.14 60)', flexShrink: 0 }} />
                    {m.tenant?.name ?? '알 수 없는 조직'} 대기 중
                  </span>
                ))}
              </div>
            )}

            {/* ── 신규 유저: 시작 방법 선택 ── */}
            {!isAdminRole && memberships?.length === 0 && !hasPending && mode === 'choose' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                <button onClick={() => setMode('start-service')} className="pending-choice-btn" style={{ border: `2px solid ${accent}`, background: accentSoft }}>
                  <span style={{ fontSize: 13.5, fontWeight: 700, color: accentInk }}>내 서비스 시작하기</span>
                  <span style={{ fontSize: 11.5, color: '#8A8F99' }}>나만의 조직을 직접 만들고 관리합니다 (Basic 무료)</span>
                </button>
                <button onClick={() => { setMode('join-org'); setShowForm(true) }} className="pending-choice-btn" style={{ border: '1.5px solid rgba(20,23,28,0.12)' }}>
                  <span style={{ fontSize: 13.5, fontWeight: 700, color: '#14171C' }}>기존 조직에 가입하기</span>
                  <span style={{ fontSize: 11.5, color: '#8A8F99' }}>운영 중인 조직에 구성원으로 가입합니다</span>
                </button>
              </div>
            )}

            {/* ── 내 서비스 시작하기 폼 ── */}
            {mode === 'start-service' && (
              <form onSubmit={handleCreateCustomer} style={{ marginBottom: 16 }}>
                <div style={{ marginBottom: 10 }}>
                  <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: '#353A44', marginBottom: 5 }}>서비스 계정 이름</label>
                  <input type="text" required value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="예: 홍길동 미용실" style={inputSt} />
                </div>
                {error && <div style={errBox}>{error}</div>}
                <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                  <button type="submit" disabled={customerCreating || !customerName.trim()} className="pending-submit-btn" style={{ flex: 2 }}>
                    {customerCreating ? '생성 중...' : '시작하기'}
                    {!customerCreating && arrowIcon}
                  </button>
                  <button type="button" onClick={() => setMode('choose')} className="pending-ghost-btn" style={{ flex: 1 }}>뒤로</button>
                </div>
              </form>
            )}

            {/* ── 기존 조직 가입 신청 버튼 (재신청용) ── */}
            {!isAdminRole && (mode === 'join-org' || (memberships !== null && memberships.length > 0)) && !showForm && (
              <div style={{ marginBottom: 16 }}>
                <button
                  onClick={() => setShowForm(true)}
                  style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600, borderRadius: 10, border: `1.5px solid ${accent}`, color: accent, background: accentSoft, cursor: 'pointer', fontFamily: 'inherit', transition: 'background .12s' }}
                >
                  조직에 가입 신청하기
                </button>
              </div>
            )}

            {/* ── 조직 선택 폼 (드롭다운) ── */}
            {!isAdminRole && mode === 'join-org' && showForm && (
              <div style={{ marginBottom: 16 }}>

                {/* 서비스 드롭다운 */}
                <div style={{ marginBottom: 10 }}>
                  <label style={labelSt}>서비스 선택</label>
                  <div style={{ position: 'relative' }}>
                    <select
                      value={selCustomerId}
                      onChange={e => { setSelCustomerId(e.target.value); setSelTenantId(''); setSelTenantRoles(null); setSelRole(null); setError(null) }}
                      style={selectSt}
                    >
                      <option value="">서비스를 선택하세요</option>
                      {availableCustomers.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  {showForm && allTenants.length === 0 && (
                    <p style={{ fontSize: 12, color: '#8A8F99', margin: '6px 0 0' }}>
                      신청 가능한 서비스가 없습니다. 이미 모든 조직에 신청했거나 가입된 상태입니다.
                    </p>
                  )}
                </div>

                {/* 조직 드롭다운 (서비스 선택 후) */}
                {selCustomerId && (
                  <div style={{ marginBottom: 10 }}>
                    <label style={labelSt}>조직 선택</label>
                    <select
                      value={selTenantId}
                      onChange={e => onSelectTenant(e.target.value)}
                      style={selectSt}
                    >
                      <option value="">조직을 선택하세요</option>
                      {customerTenants.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* 활동 유형 (조직 선택 후) */}
                {selTenantId && (
                  <div style={{ marginBottom: 10 }}>
                    <label style={labelSt}>
                      활동 유형 <span style={{ color: 'oklch(0.55 0.16 25)' }}>*</span>
                    </label>
                    {loadingRoles ? (
                      <p style={{ fontSize: 12.5, color: '#8A8F99', margin: 0 }}>로딩 중...</p>
                    ) : selTenantRoles !== null && selTenantRoles.length === 0 ? (
                      <p style={{ fontSize: 12.5, color: 'oklch(0.55 0.16 25)', margin: 0 }}>이 조직은 활동 유형이 등록되지 않았습니다.</p>
                    ) : selTenantRoles !== null && selTenantRoles.length > 0 ? (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 6 }}>
                        {selTenantRoles.map(tr => (
                          <button key={tr.id} type="button" onClick={() => { setSelRole({ roleId: tr.id, defaultRole: null }); setError(null) }}
                            style={{ padding: '8px 10px', borderRadius: 9, fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', transition: 'all .15s', border: `2px solid ${selRole?.roleId === tr.id ? accent : 'rgba(20,23,28,0.12)'}`, background: selRole?.roleId === tr.id ? accentSoft : '#fff', color: selRole?.roleId === tr.id ? accentInk : '#6B7280' }}>
                            {tr.name}
                          </button>
                        ))}
                      </div>
                    ) : selTenantRoles !== null ? (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }}>
                        {defaultRoles.map(r => (
                          <button key={r.value} type="button" onClick={() => { setSelRole({ roleId: null, defaultRole: r.value }); setError(null) }}
                            style={{ padding: '8px 8px', borderRadius: 9, fontSize: 12, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', transition: 'all .15s', border: `2px solid ${selRole?.defaultRole === r.value ? accent : 'rgba(20,23,28,0.12)'}`, background: selRole?.defaultRole === r.value ? accentSoft : '#fff', color: selRole?.defaultRole === r.value ? accentInk : '#6B7280' }}>
                            {r.label}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                )}

                {error && <div style={errBox}>{error}</div>}

                <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                  <button onClick={handleReapply} disabled={submitting || !selTenantId} className="pending-submit-btn" style={{ flex: 2 }}>
                    {submitting ? '신청 중...' : '신청하기'}
                    {!submitting && arrowIcon}
                  </button>
                  <button onClick={resetForm} className="pending-ghost-btn" style={{ flex: 1 }}>취소</button>
                </div>
              </div>
            )}

            {/* ── 하단 액션 ── */}
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button
                onClick={() => { setWithdrawTenantId(pendingOrgs.length === 1 ? pendingOrgs[0].tenant_id : ''); setShowWithdrawModal(true) }}
                style={{ flex: 1, height: 38, fontSize: 12.5, fontWeight: 500, fontFamily: 'inherit', borderRadius: 10, border: '1px solid oklch(0.88 0.06 25)', background: 'transparent', color: 'oklch(0.55 0.15 25)', cursor: 'pointer', transition: 'background .12s' }}
              >
                회원탈퇴
              </button>
            </div>
          </>
        )}
      </div>

      {/* ── 탈퇴 확인 모달 ── */}
      {showWithdrawModal && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(20,23,28,0.45)', backdropFilter: 'blur(4px)' }} onClick={() => setShowWithdrawModal(false)} />
          <div style={{ position: 'fixed', inset: 0, zIndex: 101, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <div style={{ background: '#fff', border: '1px solid rgba(20,23,28,0.07)', borderRadius: 18, padding: '24px 24px 20px', width: '100%', maxWidth: 340, boxShadow: '0 22px 60px -28px rgba(20,23,28,0.30)' }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: '#14171C', margin: '0 0 16px' }}>탈퇴 방식 선택</h2>

              {pendingOrgs.length > 1 && (
                <div style={{ marginBottom: 12 }}>
                  <select value={withdrawTenantId} onChange={e => setWithdrawTenantId(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 10, border: '1px solid rgba(20,23,28,0.12)', background: '#fff', fontSize: 13, fontFamily: 'inherit', color: '#14171C', outline: 'none', marginBottom: 8 }}>
                    <option value="">조직 선택</option>
                    {pendingOrgs.map(m => <option key={m.tenant_id} value={m.tenant_id}>{m.tenant?.name ?? m.tenant_id}</option>)}
                  </select>
                  <button
                    disabled={!withdrawTenantId}
                    onClick={async () => { setShowWithdrawModal(false); const err = await deleteAccount(withdrawTenantId); if (err) alert(err); else await reloadMemberships() }}
                    style={{ width: '100%', padding: '12px 16px', textAlign: 'left', borderRadius: 12, border: '1px solid rgba(20,23,28,0.09)', background: '#F4F1EA', cursor: 'pointer', fontFamily: 'inherit', marginBottom: 8, opacity: withdrawTenantId ? 1 : 0.4 }}
                  >
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: '#14171C' }}>현재 조직 탈퇴</div>
                    <div style={{ fontSize: 12, color: '#8A8F99', marginTop: 2 }}>선택한 조직의 가입 신청을 취소합니다.</div>
                  </button>
                </div>
              )}

              <button
                onClick={async () => { setShowWithdrawModal(false); const err = await deleteAccount(); if (err) alert(err) }}
                style={{ width: '100%', padding: '12px 16px', textAlign: 'left', borderRadius: 12, border: '1px solid oklch(0.88 0.06 25)', background: 'oklch(0.98 0.02 25)', cursor: 'pointer', fontFamily: 'inherit', marginBottom: 10 }}
              >
                <div style={{ fontSize: 13.5, fontWeight: 600, color: 'oklch(0.45 0.15 25)' }}>전체 계정 삭제</div>
                <div style={{ fontSize: 12, color: 'oklch(0.60 0.10 25)', marginTop: 2 }}>모든 조직에서 탈퇴하고 계정을 완전히 삭제합니다.</div>
              </button>

              <button onClick={() => setShowWithdrawModal(false)} style={{ width: '100%', height: 38, fontSize: 13, color: '#8A8F99', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                취소
              </button>
            </div>
          </div>
        </>
      )}
    </ScheduleBackground>
  )
}
