import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useTenant } from '../contexts/TenantContext'
import { supabase } from '../lib/supabase'

interface TenantRole { id: string; name: string; display_order: number }
interface Tenant { id: string; name: string }

export function PendingPage() {
  const { profile, signOut, deleteAccount, refreshCustomer } = useAuth()
  const { reloadMemberships } = useTenant()
  const navigate = useNavigate()

  // 'choose' | 'start-service' | 'join-org'
  const [mode, setMode] = useState<'choose' | 'start-service' | 'join-org'>('choose')
  const [customerName, setCustomerName] = useState('')
  const [customerCreating, setCustomerCreating] = useState(false)

  const [showForm, setShowForm] = useState(false)
  const [tenants, setTenants] = useState<Tenant[]>([])

  const [selectedOrgIds, setSelectedOrgIds] = useState<Set<string>>(new Set())
  const [orgRolesMap, setOrgRolesMap] = useState<Map<string, TenantRole[] | null>>(new Map())
  const [orgTypeLabelsMap, setOrgTypeLabelsMap] = useState<Map<string, { volunteer: string; '50plus': string } | null>>(new Map())
  const [selectedRoleMap, setSelectedRoleMap] = useState<Map<string, { roleId: string | null; defaultRole: string | null }>>(new Map())

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

  // Note: 신규 유저(memberships.length===0)는 choose 모드로 시작 — 자동 showForm 불필요

  useEffect(() => {
    if (!showForm || memberships === null) return
    const mine = new Set(memberships.map(m => m.tenant_id))
    supabase.from('tenants').select('id, name').order('name').then(({ data }) => {
      setTenants((data ?? []).filter(t => !mine.has(t.id)))
    })
  }, [showForm, memberships])

  async function fetchOrgRoles(orgId: string) {
    if (orgRolesMap.has(orgId)) return
    const [{ data: roles }, { data: tenantData }] = await Promise.all([
      supabase.from('tenant_roles').select('id, name, display_order').eq('tenant_id', orgId).order('display_order'),
      supabase.from('tenants').select('settings').eq('id', orgId).single(),
    ])
    const s = (tenantData as { settings?: { volunteer_label?: string; plus_label?: string } } | null)?.settings
    setOrgRolesMap(prev => new Map(prev).set(orgId, roles ?? []))
    setOrgTypeLabelsMap(prev => new Map(prev).set(orgId, {
      volunteer: s?.volunteer_label ?? '팀원',
      '50plus': s?.plus_label ?? '50플러스',
    }))
  }

  function toggleOrg(orgId: string) {
    setError(null)
    setSelectedOrgIds(prev => {
      const next = new Set(prev)
      if (next.has(orgId)) {
        next.delete(orgId)
        setSelectedRoleMap(r => { const m = new Map(r); m.delete(orgId); return m })
      } else {
        next.add(orgId)
        fetchOrgRoles(orgId)
      }
      return next
    })
  }

  function selectRole(orgId: string, roleId: string | null, defaultRole: string | null) {
    setSelectedRoleMap(prev => new Map(prev).set(orgId, { roleId, defaultRole }))
    setError(null)
  }

  const isAdminRole = profile?.is_super_admin

  const waitMessage = hasPending
    ? isAdminRole
      ? '관리자 계정은 슈퍼관리자의 승인 후 활성화됩니다.'
      : '조직 관리자의 승인을 기다리고 있습니다.'
    : '신청할 조직을 선택해 주세요.'

  async function handleReapply() {
    if (selectedOrgIds.size === 0) { setError('가입할 조직을 선택해주세요.'); return }

    for (const orgId of selectedOrgIds) {
      const roles = orgRolesMap.get(orgId)
      const hasCustomRoles = roles !== null && roles !== undefined && roles.length > 0
      const hasNoRoles = roles !== null && roles !== undefined && roles.length === 0
      const sel = selectedRoleMap.get(orgId)
      const tenant = tenants.find(t => t.id === orgId)
      const orgName = tenant?.name ?? orgId

      if (hasNoRoles) { setError(`${orgName} 조직은 아직 활동 유형이 등록되지 않았습니다.`); return }
      if (roles === null || roles === undefined) { setError(`${orgName} 조직의 역할 정보를 불러오는 중입니다.`); return }
      if (hasCustomRoles && !sel?.roleId) { setError(`${orgName} 조직의 활동 유형을 선택해주세요.`); return }
      if (!hasCustomRoles && !sel?.defaultRole) { setError(`${orgName} 조직의 활동 유형을 선택해주세요.`); return }
    }

    setError(null)
    setSubmitting(true)

    const isFirstRequest = (memberships?.length ?? 0) === 0
    const errors: string[] = []

    for (const orgId of selectedOrgIds) {
      const roles = orgRolesMap.get(orgId)
      const hasCustomRoles = roles !== null && roles !== undefined && roles.length > 0
      const sel = selectedRoleMap.get(orgId)
      const orgName = tenants.find(t => t.id === orgId)?.name ?? orgId

      const { error: insertErr } = await supabase
        .from('tenant_members')
        .insert({
          tenant_id: orgId,
          user_id: profile!.id,
          role: 'member',
          role_id: hasCustomRoles ? (sel?.roleId ?? null) : null,
        })

      if (insertErr) {
        if (insertErr.code === '23505') continue
        errors.push(`${orgName}: ${insertErr.message}`)
      }
    }

    setSubmitting(false)

    if (errors.length > 0) {
      setError(errors.join('\n'))
      return
    }

    if (isFirstRequest) {
      setSubmitted(true)
      setShowForm(false)
    } else {
      const { data } = await supabase
        .from('tenant_members')
        .select('tenant_id, is_approved, tenant:tenants(name)')
        .eq('user_id', profile!.id)
      setMemberships((data ?? []) as unknown as MyMembership[])
      resetForm()
    }
  }

  function resetForm() {
    setShowForm(false)
    setSelectedOrgIds(new Set())
    setOrgRolesMap(new Map())
    setOrgTypeLabelsMap(new Map())
    setSelectedRoleMap(new Map())
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
    if (error) {
      setError(`오류: ${error.message}`)
      setCustomerCreating(false)
      return
    }
    if (data) {
      await refreshCustomer()
      navigate('/customer-admin')
    }
    setCustomerCreating(false)
  }

  const roleBtn = (selected: boolean) =>
    `py-2 px-3 rounded-xl text-xs font-semibold border-2 transition-all duration-200 ${
      selected
        ? 'border-[var(--color-brand-primary)] bg-[var(--color-brand-primary)]/8 text-[var(--color-brand-primary)]'
        : 'border-[var(--color-border-strong)] text-[var(--color-text-secondary)] hover:border-[var(--color-text-muted)]'
    }`

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg)] px-4">
      <div className="w-full max-w-md text-center">
        <div className="text-4xl mb-4">{submitted ? '✅' : '⏳'}</div>
        <h1 className="text-xl font-bold text-[var(--color-text)] mb-2">
          {submitted ? '신청 완료' : '승인 대기 중'}
        </h1>
        <p className="text-sm text-[var(--color-text-secondary)] mb-3">
          {profile?.name ? `${profile.name}님, ` : ''}
          {submitted
            ? '신청이 완료됐습니다. 관리자의 승인을 기다려 주세요.'
            : waitMessage
          }
        </p>
        {!submitted && hasPending && pendingOrgs.length > 0 && (
          <div className="flex flex-wrap gap-1.5 justify-center mb-5">
            {pendingOrgs.map(m => (
              <span key={m.tenant_id} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/40">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 dark:bg-amber-500" />
                {m.tenant?.name ?? '알 수 없는 조직'} 대기 중
              </span>
            ))}
          </div>
        )}

        {!isAdminRole && !submitted && (
          <div className="mb-4">
            {/* 완전 신규 유저: 서비스 시작 or 조직 가입 선택 */}
            {memberships?.length === 0 && !hasPending && mode === 'choose' && (
              <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-4 text-left space-y-3">
                <p className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide mb-1">시작하기</p>
                <button
                  onClick={() => setMode('start-service')}
                  className="w-full text-left px-4 py-3 rounded-xl border-2 border-[var(--color-brand-primary)] bg-[var(--color-brand-primary)]/5 hover:bg-[var(--color-brand-primary)]/10 transition-colors"
                >
                  <p className="text-sm font-bold text-[var(--color-brand-primary)]">내 서비스 시작하기</p>
                  <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">나만의 조직을 직접 만들고 관리합니다 (Basic 무료)</p>
                </button>
                <button
                  onClick={() => { setMode('join-org'); setShowForm(true) }}
                  className="w-full text-left px-4 py-3 rounded-xl border border-[var(--color-border-strong)] hover:bg-[var(--color-surface-hover)] transition-colors"
                >
                  <p className="text-sm font-semibold text-[var(--color-text-primary)]">기존 조직에 가입하기</p>
                  <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">운영 중인 조직에 구성원으로 가입합니다</p>
                </button>
              </div>
            )}

            {/* 내 서비스 시작하기 폼 */}
            {mode === 'start-service' && (
              <form onSubmit={handleCreateCustomer} className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-4 text-left space-y-3">
                <p className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide">서비스 계정 이름</p>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  placeholder="예: 홍길동 미용실"
                  className="w-full px-3 py-2 rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-primary)]/30 focus:border-[var(--color-brand-primary)]"
                />
                {error && <p className="text-xs text-red-500">{error}</p>}
                <div className="flex gap-2">
                  <button type="submit" disabled={customerCreating || !customerName.trim()}
                    className="flex-1 py-2 text-sm font-semibold rounded-xl bg-[var(--color-brand-primary)] text-white hover:opacity-90 disabled:opacity-40 transition-colors">
                    {customerCreating ? '생성 중...' : '시작하기'}
                  </button>
                  <button type="button" onClick={() => setMode('choose')}
                    className="flex-1 py-2 text-sm font-medium rounded-xl border border-[var(--color-border-strong)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] transition-colors">
                    뒤로
                  </button>
                </div>
              </form>
            )}

            {/* 기존 조직 가입 폼 */}
            {(mode === 'join-org' || (memberships !== null && memberships.length > 0)) && !showForm ? (
              <button
                onClick={() => setShowForm(true)}
                className="px-4 py-2 text-sm font-medium rounded-xl border border-[var(--color-brand-primary)] text-[var(--color-brand-primary)] hover:bg-[var(--color-brand-primary)]/8 transition-colors"
              >
                조직에 가입 신청하기
              </button>
            ) : mode === 'join-org' && showForm ? (
              <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-4 text-left space-y-3">
                <p className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide">가입 신청</p>

                {tenants.length === 0 ? (
                  <p className="text-xs text-[var(--color-text-muted)] py-1">
                    신청 가능한 조직이 없습니다. 이미 모든 조직에 신청했거나 가입된 상태입니다.
                  </p>
                ) : (
                  <div className="space-y-2">
                    <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
                      조직 선택 <span className="text-red-500">*</span>
                    </label>
                    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                      {tenants.map(t => {
                        const roles = orgRolesMap.get(t.id)
                        const hasNoRoles = roles !== null && roles !== undefined && roles.length === 0
                        const hasCustomRoles = roles !== null && roles !== undefined && roles.length > 0
                        const isChecked = selectedOrgIds.has(t.id)
                        const sel = selectedRoleMap.get(t.id)
                        const typeLabels = orgTypeLabelsMap.get(t.id)
                        const effectiveDefaultRoles = [
                          { value: 'volunteer', label: typeLabels?.volunteer ?? '팀원' },
                          { value: '50plus', label: typeLabels?.['50plus'] ?? '50플러스' },
                          { value: 'team_leader', label: '팀장' },
                        ]

                        return (
                          <div
                            key={t.id}
                            className={`rounded-xl border transition-all duration-150 ${
                              isChecked
                                ? 'border-[var(--color-brand-primary)] bg-[var(--color-brand-primary)]/5'
                                : 'border-[var(--color-border)] bg-[var(--color-surface-secondary)]'
                            } ${hasNoRoles ? 'opacity-60' : ''}`}
                          >
                            <label className={`flex items-center gap-2.5 px-3 py-2.5 ${hasNoRoles ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                              <input
                                type="checkbox"
                                disabled={hasNoRoles}
                                checked={isChecked}
                                onChange={() => !hasNoRoles && toggleOrg(t.id)}
                                className="accent-[var(--color-brand-primary)] w-4 h-4 flex-shrink-0"
                              />
                              <span className="text-sm font-medium text-[var(--color-text-primary)] flex-1">{t.name}</span>
                              {hasNoRoles && (
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 whitespace-nowrap">
                                  활동유형 미등록
                                </span>
                              )}
                            </label>

                            {isChecked && (
                              <div className="px-3 pb-3 pt-1 border-t border-[var(--color-border)]">
                                <p className="text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">
                                  활동 유형 <span className="text-red-500">*</span>
                                </p>
                                {roles === null || roles === undefined ? (
                                  <p className="text-xs text-[var(--color-text-muted)]">로딩 중...</p>
                                ) : hasCustomRoles ? (
                                  <div className="grid grid-cols-2 gap-1.5">
                                    {roles.map(tr => (
                                      <button key={tr.id} type="button"
                                        onClick={() => selectRole(t.id, tr.id, null)}
                                        className={roleBtn(sel?.roleId === tr.id)}>
                                        {tr.name}
                                      </button>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="grid grid-cols-3 gap-1.5">
                                    {effectiveDefaultRoles.map(r => (
                                      <button key={r.value} type="button"
                                        onClick={() => selectRole(t.id, null, r.value)}
                                        className={roleBtn(sel?.defaultRole === r.value)}>
                                        {r.label}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {error && (
                  <p className="text-xs text-red-500 bg-red-50 dark:bg-red-950/30 px-3 py-2 rounded-lg whitespace-pre-line">{error}</p>
                )}

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={handleReapply}
                    disabled={submitting || tenants.length === 0}
                    className="flex-1 py-2 text-sm font-semibold rounded-xl bg-[var(--color-brand-primary)] text-white hover:bg-[var(--color-brand-primary-hover)] disabled:opacity-50 transition-colors"
                  >
                    {submitting ? '신청 중...' : `신청하기${selectedOrgIds.size > 0 ? ` (${selectedOrgIds.size}개)` : ''}`}
                  </button>
                  <button
                    onClick={resetForm}
                    className="flex-1 py-2 text-sm font-medium rounded-xl border border-[var(--color-border-strong)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] transition-colors"
                  >
                    취소
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        )}

        <div className="flex gap-2 justify-center">
          <button
            onClick={signOut}
            className="px-4 py-2 text-sm border border-[var(--color-border)] rounded-xl text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] transition-colors"
          >
            로그아웃
          </button>
          <button
            onClick={() => {
              setWithdrawTenantId(pendingOrgs.length === 1 ? pendingOrgs[0].tenant_id : '')
              setShowWithdrawModal(true)
            }}
            className="px-4 py-2 text-sm border border-red-200 dark:border-red-800/40 rounded-xl text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
          >
            회원탈퇴
          </button>
        </div>
      </div>

      {showWithdrawModal && (
        <>
          <div className="fixed inset-0 z-50 bg-black/40" onClick={() => setShowWithdrawModal(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-lg w-full max-w-xs p-5 space-y-3">
              <h2 className="text-base font-semibold text-[var(--color-text-primary)]">탈퇴 방식 선택</h2>
              {pendingOrgs.length > 1 && (
                <div className="space-y-2">
                  {pendingOrgs.length > 1 && (
                    <select
                      value={withdrawTenantId}
                      onChange={e => setWithdrawTenantId(e.target.value)}
                      className="w-full border border-[var(--color-border-strong)] rounded-xl px-3 py-2 text-sm bg-[var(--color-surface-secondary)] text-[var(--color-text-primary)] focus:outline-none"
                    >
                      <option value="">조직 선택</option>
                      {pendingOrgs.map(m => (
                        <option key={m.tenant_id} value={m.tenant_id}>{m.tenant?.name ?? m.tenant_id}</option>
                      ))}
                    </select>
                  )}
                  <button
                    disabled={!withdrawTenantId}
                    onClick={async () => {
                      setShowWithdrawModal(false)
                      const err = await deleteAccount(withdrawTenantId)
                      if (err) alert(err)
                      else await reloadMemberships()
                    }}
                    className="w-full px-4 py-3 text-left rounded-xl border border-[var(--color-border)] hover:bg-[var(--color-surface-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">현재 조직 탈퇴</p>
                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5">선택한 조직의 가입 신청을 취소합니다.</p>
                  </button>
                </div>
              )}
              <button
                onClick={async () => {
                  setShowWithdrawModal(false)
                  const err = await deleteAccount()
                  if (err) alert(err)
                }}
                className="w-full px-4 py-3 text-left rounded-xl border border-red-200 dark:border-red-800/40 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
              >
                <p className="text-sm font-medium text-red-600 dark:text-red-400">전체 계정 삭제</p>
                <p className="text-xs text-red-400 dark:text-red-500 mt-0.5">모든 조직에서 탈퇴하고 계정을 완전히 삭제합니다.</p>
              </button>
              <button
                onClick={() => setShowWithdrawModal(false)}
                className="w-full py-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
              >
                취소
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
