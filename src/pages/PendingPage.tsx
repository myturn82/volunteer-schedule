import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useTenant } from '../contexts/TenantContext'
import { supabase } from '../lib/supabase'
import { ScheduleBackground } from '../components/auth/ScheduleBackground'

interface TenantRole { id: string; name: string; display_order: number }

const IArrow = () => (
  <svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 10h12M11 5l5 5-5 5"/>
  </svg>
)
const IBack = () => (
  <svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 10H4M9 5l-5 5 5 5"/>
  </svg>
)
const ICheck = () => (
  <svg viewBox="0 0 20 20" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="m4 10 4 4 8-9"/>
  </svg>
)
const IClock = () => (
  <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>
  </svg>
)
const ISpark = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/>
    <rect x="14" y="3" width="7" height="7" rx="2"/><path d="M17.5 14v7M14 17.5h7"/>
  </svg>
)
const IJoin = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4"/><path d="m10 8 4 4-4 4"/><path d="M14 12H4"/>
  </svg>
)

const labelSt: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--ink-700)', marginBottom: 7 }

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

  useEffect(() => {
    if (!showForm || memberships === null) return
    const mine = new Set(memberships.map(m => m.tenant_id))
    ;(async () => {
      const { data: tenantsData } = await supabase
        .from('tenants').select('id, name, customer_id').order('name')
      const available = (tenantsData ?? []).filter(
        (t: { id: string; customer_id: string | null }) => !mine.has(t.id) && t.customer_id
      ) as { id: string; name: string; customer_id: string }[]
      const customerIds = [...new Set(available.map(t => t.customer_id))]
      const { data: customersData } = customerIds.length > 0
        ? await supabase.from('customers').select('id, name').in('id', customerIds)
        : { data: [] as { id: string; name: string }[] }
      const customerMap = new Map((customersData ?? []).map(c => [c.id, c.name]))
      setAllTenants(available.map(t => ({
        id: t.id, name: t.name, customerId: t.customer_id,
        customerName: customerMap.get(t.customer_id) ?? '',
      })))
    })()
  }, [showForm, memberships])

  const availableCustomers = [...new Map(
    allTenants.map(t => [t.customerId, { id: t.customerId, name: t.customerName || t.customerId.slice(0, 8) }])
  ).values()].sort((a, b) => a.name.localeCompare(b.name, 'ko'))

  const customerTenants = allTenants.filter(t => t.customerId === selCustomerId)

  async function onSelectTenant(tenantId: string) {
    setSelTenantId(tenantId); setSelRole(null); setSelTenantRoles(null); setError(null)
    if (!tenantId) return
    setLoadingRoles(true)
    const [{ data: roles }, { data: tenantData }] = await Promise.all([
      supabase.from('tenant_roles').select('id, name, display_order').eq('tenant_id', tenantId).order('display_order'),
      supabase.from('tenants').select('settings').eq('id', tenantId).single(),
    ])
    const s = (tenantData as { settings?: { volunteer_label?: string; plus_label?: string } } | null)?.settings
    setSelTenantRoles(roles ?? [])
    setSelTenantTypeLabels({ volunteer: s?.volunteer_label ?? '팀원', '50plus': s?.plus_label ?? '50플러스' })
    setLoadingRoles(false)
  }

  const isAdminRole = profile?.is_super_admin

  const waitMessage = hasPending
    ? isAdminRole ? '관리자 계정은 슈퍼관리자의 승인 후 활성화됩니다.' : '조직 관리자의 승인을 기다리고 있어요.'
    : '신청할 조직을 선택해 주세요.'

  async function handleReapply() {
    if (!selTenantId) { setError('조직을 선택해주세요.'); return }
    if (selTenantRoles === null) { setError('역할 정보를 불러오는 중입니다. 잠시 후 다시 시도해주세요.'); return }
    const hasCustomRoles = selTenantRoles.length > 0
    if (selTenantRoles.length === 0) { setError('이 조직은 아직 활동 유형이 등록되지 않았습니다.'); return }
    if (hasCustomRoles && !selRole?.roleId) { setError('활동 유형을 선택해주세요.'); return }
    if (!hasCustomRoles && !selRole?.defaultRole) { setError('활동 유형을 선택해주세요.'); return }
    setError(null); setSubmitting(true)
    const isFirstRequest = (memberships?.length ?? 0) === 0
    const { error: insertErr } = await supabase.from('tenant_members').insert({
      tenant_id: selTenantId, user_id: profile!.id, role: 'member',
      role_id: hasCustomRoles ? (selRole?.roleId ?? null) : null,
    })
    if (insertErr && insertErr.code !== '23505') { setSubmitting(false); setError(insertErr.message); return }
    const { data: freshMem } = await supabase
      .from('tenant_members').select('tenant_id, is_approved, tenant:tenants(name)').eq('user_id', profile!.id)
    setMemberships((freshMem ?? []) as unknown as MyMembership[])
    setSubmitting(false)
    if (isFirstRequest) { setSubmitted(true); setShowForm(false) }
    else resetForm()
  }

  function resetForm() {
    setShowForm(false); setAllTenants([]); setSelCustomerId(''); setSelTenantId('')
    setSelTenantRoles(null); setSelRole(null); setLoadingRoles(false); setError(null)
  }

  async function handleCreateCustomer(e: React.FormEvent) {
    e.preventDefault()
    if (!profile || !customerName.trim()) return
    setCustomerCreating(true)
    const { data, error } = await supabase
      .from('customers').insert({ name: customerName.trim(), owner_user_id: profile.id, plan: 'basic' }).select().single()
    if (error) { setError(`오류: ${error.message}`); setCustomerCreating(false); return }
    if (data) { window.location.href = '/customer-admin'; return }
    setCustomerCreating(false)
  }

  const defaultRoles = [
    { value: 'volunteer', label: selTenantTypeLabels.volunteer },
    { value: '50plus',    label: selTenantTypeLabels['50plus'] },
    { value: 'team_leader', label: '팀장' },
  ]

  const topNavSlot = (
    <>
      <span className="lmp-nav-hint">{profile?.name}</span>
      <button className="lmp-nav-btn" onClick={signOut}>로그아웃</button>
    </>
  )

  return (
    <ScheduleBackground topNavSlot={topNavSlot}>
      <div className="af-card wide" style={{ overflowY: 'auto', maxHeight: 'calc(100dvh - 140px)' }}>

        {/* ── 신청 완료 ── */}
        {submitted ? (
          <div style={{ textAlign: 'center', padding: '12px 0 6px' }}>
            <div className="af-status-ic"><IClock /></div>
            <span className="af-eyebrow" style={{ textAlign: 'center' }}>SUBMITTED</span>
            <h2 className="af-title" style={{ textAlign: 'center', fontSize: 22 }}>신청 완료</h2>
            <p className="af-sub" style={{ textAlign: 'center' }}>
              신청이 접수됐어요.<br />관리자의 승인을 기다려 주세요.
            </p>
            <button className="af-btn af-btn-ghost" onClick={() => {
              setSubmitted(false)
              setSelCustomerId(''); setSelTenantId(''); setSelRole(null); setSelTenantRoles(null); setError(null)
              setShowForm(true)
            }}>돌아가기</button>
          </div>
        ) : (
          <>
            <span className="af-eyebrow">{hasPending ? 'PENDING' : 'GET STARTED'}</span>
            <h2 className="af-title" style={{ fontSize: 24 }}>{hasPending ? '승인 대기 중' : '시작하기'}</h2>
            <p className="af-sub">
              {profile?.name ? <><b>{profile.name}</b>님, </> : ''}{waitMessage}
            </p>

            {/* 대기 중인 조직 태그 */}
            {hasPending && pendingOrgs.length > 0 && (
              <div className="af-org-tags">
                {pendingOrgs.map(m => (
                  <span key={m.tenant_id} className="af-org-tag">
                    <span className="af-dot" />
                    {m.tenant?.name ?? '알 수 없는 조직'} 대기 중
                  </span>
                ))}
              </div>
            )}

            {/* ── 신규 유저 선택 ── */}
            {!isAdminRole && memberships?.length === 0 && !hasPending && mode === 'choose' && (
              <div className="af-choices">
                <button className="af-choice" onClick={() => setMode('start-service')}>
                  <span className="af-choice-ic"><ISpark /></span>
                  <span className="af-choice-body">
                    <span className="af-choice-t">내 서비스 시작하기 <span className="af-badge">BASIC 무료</span></span>
                    <span className="af-choice-d">나만의 조직을 직접 만들고 관리합니다</span>
                  </span>
                </button>
                <button className="af-choice" onClick={() => { setMode('join-org'); setShowForm(true) }}>
                  <span className="af-choice-ic"><IJoin /></span>
                  <span className="af-choice-body">
                    <span className="af-choice-t">기존 조직에 가입하기</span>
                    <span className="af-choice-d">운영 중인 조직에 구성원으로 가입합니다</span>
                  </span>
                </button>
              </div>
            )}

            {/* ── 내 서비스 시작하기 ── */}
            {mode === 'start-service' && (
              <form onSubmit={handleCreateCustomer}>
                <div className="af-field">
                  <label style={labelSt}>서비스 계정 이름</label>
                  <input className="af-input plain" type="text" required value={customerName}
                    onChange={e => setCustomerName(e.target.value)} placeholder="예: 홍길동 미용실" />
                </div>
                {error && <div className="af-err">{error}</div>}
                <div className="af-btn-row">
                  <button type="submit" className="af-btn af-btn-primary"
                    disabled={customerCreating || !customerName.trim()} style={{ flex: 2 }}>
                    {customerCreating ? '생성 중...' : <>시작하기 <IArrow /></>}
                  </button>
                  <button type="button" className="af-btn af-btn-ghost" style={{ flex: 1 }} onClick={() => setMode('choose')}>뒤로</button>
                </div>
              </form>
            )}

            {/* ── 조직 가입 신청 버튼 (재신청) ── */}
            {!isAdminRole && (mode === 'join-org' || (memberships !== null && memberships.length > 0)) && !showForm && (
              <div style={{ marginBottom: 16 }}>
                <button onClick={() => setShowForm(true)}
                  style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600, borderRadius: 'var(--r-sm)', border: '1.5px solid var(--accent)', color: 'var(--accent)', background: 'var(--accent-soft)', cursor: 'pointer', fontFamily: 'inherit', transition: 'background .12s' }}>
                  조직에 가입 신청하기
                </button>
              </div>
            )}

            {/* ── 조직 선택 폼 ── */}
            {!isAdminRole && mode === 'join-org' && showForm && (
              <div>
                {/* 서비스 드롭다운 */}
                <div className="af-field">
                  <label style={labelSt}>서비스 선택</label>
                  <select className="af-select" value={selCustomerId}
                    onChange={e => { setSelCustomerId(e.target.value); setSelTenantId(''); setSelTenantRoles(null); setSelRole(null); setError(null) }}>
                    <option value="">서비스를 선택하세요</option>
                    {availableCustomers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  {allTenants.length === 0 && (
                    <p style={{ fontSize: 12, color: 'var(--ink-400)', margin: '6px 0 0' }}>
                      신청 가능한 서비스가 없습니다.
                    </p>
                  )}
                </div>

                {/* 조직 드롭다운 */}
                {selCustomerId && (
                  <div className="af-field">
                    <label style={labelSt}>조직 선택</label>
                    <select className="af-select" value={selTenantId} onChange={e => onSelectTenant(e.target.value)}>
                      <option value="">조직을 선택하세요</option>
                      {customerTenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>
                )}

                {/* 활동 유형 */}
                {selTenantId && (
                  <div className="af-field">
                    <label style={labelSt}>활동 유형 <span style={{ color: 'var(--danger)' }}>*</span></label>
                    {loadingRoles ? (
                      <p style={{ fontSize: 12.5, color: 'var(--ink-400)', margin: 0 }}>로딩 중...</p>
                    ) : selTenantRoles !== null && selTenantRoles.length === 0 ? (
                      <p style={{ fontSize: 12.5, color: 'var(--danger)', margin: 0 }}>이 조직은 활동 유형이 등록되지 않았습니다.</p>
                    ) : selTenantRoles !== null && selTenantRoles.length > 0 ? (
                      <div className="af-role-grid two">
                        {selTenantRoles.map(tr => (
                          <button key={tr.id} className={`af-role-chip${selRole?.roleId === tr.id ? ' on' : ''}`}
                            onClick={() => { setSelRole({ roleId: tr.id, defaultRole: null }); setError(null) }}>
                            {tr.name}
                          </button>
                        ))}
                      </div>
                    ) : selTenantRoles !== null ? (
                      <div className="af-role-grid">
                        {defaultRoles.map(r => (
                          <button key={r.value} className={`af-role-chip${selRole?.defaultRole === r.value ? ' on' : ''}`}
                            onClick={() => { setSelRole({ roleId: null, defaultRole: r.value }); setError(null) }}>
                            {r.label}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                )}

                {error && <div className="af-err">{error}</div>}

                <div className="af-btn-row">
                  <button className="af-btn af-btn-primary" style={{ flex: 2, opacity: submitting ? 0.6 : 1 }}
                    disabled={submitting || !selTenantId} onClick={handleReapply}>
                    {submitting ? '신청 중...' : <>신청하기 <IArrow /></>}
                  </button>
                  <button className="af-btn af-btn-ghost" style={{ flex: 1 }} onClick={resetForm}>취소</button>
                </div>
              </div>
            )}

            {/* ── 하단 탈퇴 ── */}
            <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'center' }}>
              <button style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-400)', padding: '6px 14px' }}
                onClick={() => { setWithdrawTenantId(pendingOrgs.length === 1 ? pendingOrgs[0].tenant_id : ''); setShowWithdrawModal(true) }}>
                회원탈퇴
              </button>
            </div>
          </>
        )}
      </div>

      {/* ── 탈퇴 모달 ── */}
      {showWithdrawModal && (
        <>
          <div className="af-overlay" onClick={() => setShowWithdrawModal(false)} />
          <div className="af-popup-layer">
            <div className="af-popup" style={{ maxWidth: 380 }}>
              <h3 className="af-title sm" style={{ marginBottom: 16 }}>탈퇴 방식 선택</h3>

              {pendingOrgs.length > 1 && (
                <div style={{ marginBottom: 10 }}>
                  <select value={withdrawTenantId} onChange={e => setWithdrawTenantId(e.target.value)}
                    className="af-select" style={{ marginBottom: 9 }}>
                    <option value="">조직 선택</option>
                    {pendingOrgs.map(m => <option key={m.tenant_id} value={m.tenant_id}>{m.tenant?.name ?? m.tenant_id}</option>)}
                  </select>
                  <button className="af-wd-opt" disabled={!withdrawTenantId}
                    style={{ opacity: withdrawTenantId ? 1 : 0.4 }}
                    onClick={async () => { setShowWithdrawModal(false); const err = await deleteAccount(withdrawTenantId); if (err) alert(err); else await reloadMemberships() }}>
                    <div className="af-wd-t">현재 조직 탈퇴</div>
                    <div className="af-wd-d">선택한 조직의 가입 신청을 취소합니다.</div>
                  </button>
                </div>
              )}

              <button className="af-wd-opt danger"
                onClick={async () => { setShowWithdrawModal(false); const err = await deleteAccount(); if (err) alert(err) }}>
                <div className="af-wd-t">전체 계정 삭제</div>
                <div className="af-wd-d">모든 조직에서 탈퇴하고 계정을 완전히 삭제합니다.</div>
              </button>

              <button className="af-back-link" onClick={() => setShowWithdrawModal(false)}>
                <IBack /> 취소
              </button>
            </div>
          </div>
        </>
      )}
    </ScheduleBackground>
  )
}
