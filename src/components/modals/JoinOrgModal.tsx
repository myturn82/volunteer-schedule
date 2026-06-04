import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

interface TenantRole { id: string; name: string; display_order: number }
interface Tenant { id: string; name: string }

interface Props {
  userId: string
  onClose: () => void
  onSuccess: () => void
}

export function JoinOrgModal({ userId, onClose, onSuccess }: Props) {
  const [tenants, setTenants] = useState<Tenant[] | null>(null)
  const [tenantId, setTenantId] = useState('')
  const [tenantRoles, setTenantRoles] = useState<TenantRole[] | null>(null)
  const [tenantRoleId, setTenantRoleId] = useState<string | null>(null)
  const [defaultRole, setDefaultRole] = useState<string | null>(null)
  const [tenantTypeLabels, setTenantTypeLabels] = useState<{ volunteer: string; '50plus': string } | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      supabase.from('tenants').select('id, name').order('name'),
      supabase.from('tenant_members').select('tenant_id').eq('user_id', userId),
    ]).then(([{ data: allTenants }, { data: myMemberships }]) => {
      const mine = new Set((myMemberships ?? []).map(m => m.tenant_id))
      setTenants((allTenants ?? []).filter(t => !mine.has(t.id)))
    })
  }, [userId])

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

  const hasCustomRoles = tenantRoles !== null && tenantRoles.length > 0
  const hasNoRoles = tenantRoles !== null && tenantRoles.length === 0
  const effectiveDefaultRoles = [
    { value: 'volunteer', label: tenantTypeLabels?.volunteer ?? '팀원' },
    { value: '50plus', label: tenantTypeLabels?.['50plus'] ?? '50플러스' },
    { value: 'team_leader', label: '팀장' },
  ]

  async function handleSubmit() {
    if (!tenantId) { setError('조직을 선택해주세요.'); return }
    if (hasNoRoles) { setError('이 조직은 활동 유형이 설정되어 있지 않아 가입할 수 없습니다.'); return }
    if (hasCustomRoles && !tenantRoleId) { setError('활동 유형을 선택해주세요.'); return }
    if (!hasCustomRoles && !defaultRole) { setError('활동 유형을 선택해주세요.'); return }
    if (tenantRoleId && tenantRoles && !tenantRoles.some(r => r.id === tenantRoleId)) {
      setError('선택한 역할이 해당 조직에 존재하지 않습니다.')
      setTenantRoleId(null)
      return
    }
    setError(null)
    setSubmitting(true)
    const { error: insertErr } = await supabase.from('tenant_members').insert({
      tenant_id: tenantId,
      user_id: userId,
      role: 'member',
      role_id: tenantRoleId ?? null,
    })
    setSubmitting(false)
    if (insertErr) {
      if (insertErr.code === '23505') { setError('이미 해당 조직에 신청 중입니다.'); return }
      setError(insertErr.message); return
    }
    setSubmitted(true)
    onSuccess()
  }

  const roleBtn = (selected: boolean) =>
    `py-2 px-3 rounded-xl text-xs font-semibold border-2 transition-all duration-200 ${
      selected
        ? 'border-[var(--color-brand-primary)] bg-[var(--color-brand-primary)]/8 text-[var(--color-brand-primary)]'
        : 'border-[var(--color-border-strong)] text-[var(--color-text-secondary)] hover:border-[var(--color-text-muted)]'
    }`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div
        className="w-full max-w-sm bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-5 space-y-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-[var(--color-text)]">다른 조직 가입</h2>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-colors"
          >
            <svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M5 5l10 10M15 5L5 15"/>
            </svg>
          </button>
        </div>

        {submitted ? (
          <div className="text-center py-4 space-y-2">
            <div className="text-3xl">✅</div>
            <p className="text-sm text-[var(--color-text-secondary)]">신청이 완료됐습니다. 관리자의 승인을 기다려 주세요.</p>
            <button
              onClick={onClose}
              className="mt-2 px-4 py-2 text-sm font-medium rounded-xl bg-[var(--color-brand-primary)] text-white hover:bg-[var(--color-brand-primary-hover)] transition-colors"
            >
              닫기
            </button>
          </div>
        ) : (
          <>
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                조직 <span className="text-red-500">*</span>
              </label>
              {tenants === null ? (
                <p className="text-xs text-[var(--color-text-muted)] py-2">로딩 중...</p>
              ) : tenants.length === 0 ? (
                <p className="text-xs text-[var(--color-text-muted)] py-2">
                  신청 가능한 조직이 없습니다. 이미 모든 조직에 가입했거나 신청 중입니다.
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

            {tenantId && (
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                  활동 유형 <span className="text-red-500">*</span>
                </label>
                {tenantRoles === null ? (
                  <p className="text-xs text-[var(--color-text-muted)]">로딩 중...</p>
                ) : hasNoRoles ? (
                  <p className="text-xs text-[var(--color-text-muted)] py-1">이 조직은 활동 유형이 설정되어 있지 않습니다.</p>
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

            <div className="flex gap-2">
              <button
                onClick={handleSubmit}
                disabled={submitting || !!hasNoRoles}
                className="flex-1 py-2 text-sm font-semibold rounded-xl bg-[var(--color-brand-primary)] text-white hover:bg-[var(--color-brand-primary-hover)] disabled:opacity-50 transition-colors"
              >
                {submitting ? '신청 중...' : '신청하기'}
              </button>
              <button
                onClick={onClose}
                className="flex-1 py-2 text-sm font-medium rounded-xl border border-[var(--color-border-strong)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] transition-colors"
              >
                취소
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
