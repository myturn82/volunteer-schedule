import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useTenant } from '../contexts/TenantContext'
import { supabase } from '../lib/supabase'

interface TenantRole { id: string; name: string; display_order: number }
interface Tenant { id: string; name: string }

export function PendingPage() {
  const { profile, signOut, deleteAccount } = useAuth()
  const { reloadMemberships } = useTenant()

  const [showForm, setShowForm] = useState(false)
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [tenantId, setTenantId] = useState('')

  // 조직별 커스텀 역할
  const [tenantRoles, setTenantRoles] = useState<TenantRole[] | null>(null)
  const [tenantRoleId, setTenantRoleId] = useState<string | null>(null)
  const [defaultRole, setDefaultRole] = useState<string | null>(null)
  const [tenantTypeLabels, setTenantTypeLabels] = useState<{ volunteer: string; '50plus': string } | null>(null)

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


  // 멤버십이 없는 신규 사용자(로그인 탭 카카오 등)는 폼 자동 오픈
  useEffect(() => {
    if (memberships !== null && memberships.length === 0 && !submitted && !profile?.is_super_admin) setShowForm(true)
  }, [memberships, submitted, profile?.is_super_admin])

  useEffect(() => {
    if (!showForm || memberships === null) return
    const mine = new Set(memberships.map(m => m.tenant_id))
    supabase.from('tenants').select('id, name').order('name').then(({ data }) => {
      setTenants((data ?? []).filter(t => !mine.has(t.id)))
    })
  }, [showForm, memberships])

  // 조직 변경 시 역할 완전 초기화
  useEffect(() => {
    setTenantRoles(null)
    setTenantRoleId(null)
    setDefaultRole(null)
    setTenantTypeLabels(null)
    setError(null)
    if (!tenantId) return
    Promise.all([
      supabase.from('tenant_roles').select('id, name, display_order').eq('tenant_id', tenantId).order('display_order'),
      supabase.from('tenants').select('settings').eq('id', tenantId).single(),
    ]).then(([{ data: roles }, { data: tenantData }]) => {
      setTenantRoles(roles ?? [])
      const s = (tenantData as { settings?: { volunteer_label?: string; plus_label?: string } } | null)?.settings
      setTenantTypeLabels({
        volunteer: s?.volunteer_label ?? '팀원',
        '50plus': s?.plus_label ?? '50플러스',
      })
    })
  }, [tenantId])

  const isAdminRole = profile?.is_super_admin
  const hasCustomRoles = tenantRoles !== null && tenantRoles.length > 0
  const effectiveDefaultRoles = [
    { value: 'volunteer', label: tenantTypeLabels?.volunteer ?? '팀원' },
    { value: '50plus', label: tenantTypeLabels?.['50plus'] ?? '50플러스' },
    { value: 'team_leader', label: '팀장' },
  ]

  const waitMessage = hasPending
    ? isAdminRole
      ? '관리자 계정은 슈퍼관리자의 승인 후 활성화됩니다.'
      : '조직 관리자의 승인을 기다리고 있습니다.'
    : '신청할 조직을 선택해 주세요.'

  async function handleReapply() {
    if (!tenantId) { setError('조직을 선택해주세요.'); return }
    if (hasCustomRoles && !tenantRoleId) { setError('활동 유형을 선택해주세요.'); return }
    if (!hasCustomRoles && !defaultRole) { setError('활동 유형을 선택해주세요.'); return }

    // 역할이 현재 조직 소속인지 검증
    if (tenantRoleId && tenantRoles && !tenantRoles.some(r => r.id === tenantRoleId)) {
      setError('선택한 역할이 해당 조직에 존재하지 않습니다. 다시 선택해주세요.')
      setTenantRoleId(null)
      return
    }

    setError(null)
    setSubmitting(true)

    const { error: insertErr } = await supabase
      .from('tenant_members')
      .insert({
        tenant_id: tenantId,
        user_id: profile!.id,
        role: 'member',
        role_id: tenantRoleId ?? null,
      })

    setSubmitting(false)
    if (insertErr) {
      if (insertErr.code === '23505') { setError('이미 해당 조직에 신청 중입니다.'); return }
      setError(insertErr.message); return
    }
    setSubmitted(true)
    setShowForm(false)
  }

  function resetForm() {
    setShowForm(false)
    setTenantId('')
    setTenantRoles(null)
    setTenantRoleId(null)
    setDefaultRole(null)
    setError(null)
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

        {/* 재신청 버튼 (관리자 역할 제외) */}
        {!isAdminRole && !submitted && (
          <div className="mb-4">
            {!showForm ? (
              <button
                onClick={() => setShowForm(true)}
                className="px-4 py-2 text-sm font-medium rounded-xl border border-[var(--color-brand-primary)] text-[var(--color-brand-primary)] hover:bg-[var(--color-brand-primary)]/8 transition-colors"
              >
                조직에 가입 신청하기
              </button>
            ) : (
              <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-4 text-left space-y-3">
                <p className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide">가입 신청</p>

                {/* 조직 선택 */}
                <div>
                  <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                    조직 <span className="text-red-500">*</span>
                  </label>
                  {tenants.length === 0 ? (
                    <p className="text-xs text-[var(--color-text-muted)] py-1">
                      신청 가능한 조직이 없습니다. 이미 모든 조직에 신청했거나 가입된 상태입니다.
                    </p>
                  ) : (
                    <select
                      value={tenantId}
                      onChange={e => setTenantId(e.target.value)}
                      className="w-full border border-[var(--color-border-strong)] rounded-xl px-3 py-2 text-sm bg-[var(--color-surface-secondary)] text-[var(--color-text-primary)] focus:outline-none"
                    >
                      <option value="">조직을 선택하세요</option>
                      {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  )}
                </div>

                {/* 활동 유형 (통합) */}
                {tenantId && (
                  <div>
                    <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                      활동 유형 <span className="text-red-500">*</span>
                    </label>
                    {tenantRoles === null ? (
                      <p className="text-xs text-[var(--color-text-muted)]">로딩 중...</p>
                    ) : hasCustomRoles ? (
                      <div className="grid grid-cols-2 gap-1.5">
                        {tenantRoles.map(tr => (
                          <button key={tr.id} type="button"
                            onClick={() => { setTenantRoleId(tr.id); setDefaultRole(null) }}
                            className={roleBtn(tenantRoleId === tr.id)}>
                            {tr.name}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-1.5">
                        {effectiveDefaultRoles.map(r => (
                          <button key={r.value} type="button"
                            onClick={() => { setDefaultRole(r.value); setTenantRoleId(null) }}
                            className={roleBtn(defaultRole === r.value)}>
                            {r.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {error && (
                  <p className="text-xs text-red-500 bg-red-50 dark:bg-red-950/30 px-3 py-2 rounded-lg">{error}</p>
                )}

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={handleReapply}
                    disabled={submitting}
                    className="flex-1 py-2 text-sm font-semibold rounded-xl bg-[var(--color-brand-primary)] text-white hover:bg-[var(--color-brand-primary-hover)] disabled:opacity-50 transition-colors"
                  >
                    {submitting ? '신청 중...' : '신청하기'}
                  </button>
                  <button
                    onClick={resetForm}
                    className="flex-1 py-2 text-sm font-medium rounded-xl border border-[var(--color-border-strong)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] transition-colors"
                  >
                    취소
                  </button>
                </div>
              </div>
            )}
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
