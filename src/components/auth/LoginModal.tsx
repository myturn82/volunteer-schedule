import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

interface Props {
  onClose: () => void
  onSignIn: (email: string, password: string) => Promise<string | null>
  onSignUp: (email: string, password: string, name: string, role: 'volunteer' | '50plus' | 'team_leader' | 'admin', tenantId?: string, tenantRoleId?: string) => Promise<string | null>
  onGoogle: () => Promise<string | null>
  onKakao: () => Promise<string | null>
  hideCancelButton?: boolean
}

type Mode = 'login' | 'signup'

interface TenantRole { id: string; name: string; display_order: number }
interface Tenant { id: string; name: string }

const DEFAULT_ROLES = [
  { value: 'volunteer' as const, label: '자원봉사자' },
  { value: '50plus' as const, label: '50플러스' },
  { value: 'team_leader' as const, label: '팀장' },
]

export function LoginModal({ onClose, onSignIn, onSignUp, onGoogle, onKakao, hideCancelButton }: Props) {
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [name, setName] = useState('')

  // 조직
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [tenantId, setTenantId] = useState('')

  // 활동유형 — 조직의 tenant_roles 또는 기본값
  const [tenantRoles, setTenantRoles] = useState<TenantRole[] | null>(null) // null = 아직 로드 안됨
  const [tenantRoleId, setTenantRoleId] = useState<string | null>(null)     // tenant_role 선택
  const [role, setRole] = useState<'volunteer' | '50plus' | 'team_leader' | 'admin' | null>(null) // 기본 역할 선택

  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // 조직 목록 로드
  useEffect(() => {
    supabase.from('tenants').select('id, name').order('name').then(({ data }) => {
      setTenants(data ?? [])
    })
  }, [])

  // 조직 선택 시 해당 조직의 tenant_roles 로드
  useEffect(() => {
    if (!tenantId) {
      setTenantRoles(null)
      setTenantRoleId(null)
      setRole(null)
      return
    }
    setTenantRoles(null)
    setTenantRoleId(null)
    setRole(null)
    supabase
      .from('tenant_roles')
      .select('id, name, display_order')
      .eq('tenant_id', tenantId)
      .order('display_order')
      .then(({ data }) => {
        setTenantRoles(data ?? [])
      })
  }, [tenantId])

  function switchMode(m: Mode) {
    setMode(m)
    setError(null)
    setSuccess(null)
  }

  // 현재 선택된 활동유형 (tenant_role이 있으면 우선, 없으면 기본 role)
  const hasCustomRoles = tenantRoles !== null && tenantRoles.length > 0

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    if (mode === 'login') {
      if (!email.trim() || !password) {
        setError('이메일과 비밀번호를 입력해주세요.')
        setLoading(false)
        return
      }
      const err = await onSignIn(email, password)
      setLoading(false)
      if (err) setError(err)
      else onClose()
    } else {
      if (!tenantId) {
        setError('가입할 조직을 선택해주세요.')
        setLoading(false)
        return
      }
      // 활동 유형 필수 검증
      if (hasCustomRoles && !tenantRoleId) {
        setError('활동 유형을 선택해주세요.')
        setLoading(false)
        return
      }
      if (!hasCustomRoles && !role) {
        setError('활동 유형을 선택해주세요.')
        setLoading(false)
        return
      }
      // 역할이 현재 조직 소속인지 검증
      if (tenantRoleId && tenantRoles && !tenantRoles.some(r => r.id === tenantRoleId)) {
        setError('선택한 역할이 해당 조직에 존재하지 않습니다. 다시 선택해주세요.')
        setTenantRoleId(null)
        setLoading(false)
        return
      }
      if (!name.trim()) {
        setError('이름을 입력해주세요.')
        setLoading(false)
        return
      }
      if (password !== confirmPassword) {
        setError('비밀번호가 일치하지 않습니다.')
        setLoading(false)
        return
      }
      if (password.length < 6) {
        setError('비밀번호는 6자 이상이어야 합니다.')
        setLoading(false)
        return
      }

      // profiles.role: 커스텀 역할 선택 시 'volunteer' 고정, 기본 목록 선택 시 해당 값
      const effectiveRole: 'volunteer' | '50plus' | 'team_leader' | 'admin' =
        hasCustomRoles ? 'volunteer' : (role as 'volunteer' | '50plus' | 'team_leader' | 'admin')

      const err = await onSignUp(
        email, password, name,
        effectiveRole,
        tenantId,
        tenantRoleId ?? undefined,
      )
      setLoading(false)
      if (err) setError(err)
      else setSuccess(
        effectiveRole === 'admin'
          ? '가입이 완료됐습니다. 슈퍼어드민이 승인하면 로그인하실 수 있습니다.'
          : '가입이 완료됐습니다. 조직 관리자가 승인하면 로그인하실 수 있습니다.'
      )
    }
  }

  async function handleGoogle() {
    setLoading(true); setError(null)
    const err = await onGoogle()
    setLoading(false)
    if (err) setError(err)
  }

  async function handleKakao() {
    setLoading(true); setError(null)
    const err = await onKakao()
    setLoading(false)
    if (err) setError(err)
  }

  const inputClass = 'w-full border border-[var(--color-border-strong)] rounded-xl px-3 py-2.5 text-sm bg-[var(--color-surface-secondary)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-primary)]/25 focus:border-[var(--color-brand-primary)]/60 transition-all duration-200'

  const roleBtn = (selected: boolean) =>
    `py-2.5 px-3 rounded-xl text-xs font-semibold border-2 transition-all duration-200 ${
      selected
        ? 'border-[var(--color-brand-primary)] bg-[var(--color-brand-primary)]/8 text-[var(--color-brand-primary)]'
        : 'border-[var(--color-border-strong)] text-[var(--color-text-secondary)] hover:border-[var(--color-text-muted)]'
    }`

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--color-surface)] border border-[var(--color-border-strong)] rounded-2xl shadow-[var(--shadow-xl)] w-full max-w-sm animate-scale-in">
        {/* Tabs */}
        <div className="flex border-b border-[var(--color-border)]">
          {(['login', 'signup'] as Mode[]).map(m => (
            <button key={m} onClick={() => switchMode(m)}
              className={`flex-1 py-3.5 text-sm font-semibold transition-all duration-200 border-b-2 ${
                mode === m
                  ? 'border-[var(--color-brand-primary)] text-[var(--color-brand-primary)]'
                  : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
              }`}>
              {m === 'login' ? '로그인' : '회원가입'}
            </button>
          ))}
        </div>

        <div className="p-6">
          {/* Social login */}
          <div className="space-y-2.5 mb-5">
            <button onClick={handleGoogle} disabled={loading}
              className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 border border-[var(--color-border-strong)] rounded-xl text-sm font-medium text-[var(--color-text-primary)] bg-[var(--color-surface-secondary)] hover:bg-[var(--color-surface-hover)] disabled:opacity-50 transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]">
              <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Google로 {mode === 'login' ? '로그인' : '가입'}
            </button>
            <button onClick={handleKakao} disabled={loading}
              className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 bg-[#FEE500] text-[#191919] rounded-xl text-sm font-semibold hover:bg-[#F5DB00] disabled:opacity-50 transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]">
              <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" fill="currentColor">
                <path d="M12 3C6.48 3 2 6.48 2 10.8c0 2.73 1.76 5.12 4.42 6.55l-1.12 4.1 4.78-3.15c.6.08 1.24.13 1.92.13 5.52 0 10-3.48 10-7.63C22 6.48 17.52 3 12 3z"/>
              </svg>
              카카오로 {mode === 'login' ? '로그인' : '가입'}
            </button>
          </div>

          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px bg-[var(--color-border-strong)]" />
            <span className="text-xs text-[var(--color-text-muted)]">또는 이메일로 계속</span>
            <div className="flex-1 h-px bg-[var(--color-border-strong)]" />
          </div>

          {success ? (
            <div className="text-center py-3">
              <div className="w-10 h-10 bg-green-100 dark:bg-green-950/50 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-green-500 text-lg">✓</span>
              </div>
              <p className="text-[var(--color-text-secondary)] text-sm mb-4">{success}</p>
              <button onClick={() => switchMode('login')}
                className="text-[var(--color-brand-primary)] text-sm font-medium hover:underline">
                로그인하러 가기 →
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              {mode === 'signup' && (
                <>
                  {/* 조직 선택 (필수) */}
                  <div>
                    <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">
                      가입할 조직 <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={tenantId}
                      onChange={e => setTenantId(e.target.value)}
                      className={inputClass}
                    >
                      <option value="">조직을 선택하세요</option>
                      {tenants.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* 활동 유형 (필수, 조직 선택 후 표시) */}
                  {tenantId && (
                    <div>
                      <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">
                        활동 유형 <span className="text-red-500">*</span>
                      </label>
                      {tenantRoles === null ? (
                        <p className="text-xs text-[var(--color-text-muted)]">로딩 중...</p>
                      ) : hasCustomRoles ? (
                        // 조직의 커스텀 역할만 표시
                        <div className="grid grid-cols-2 gap-2">
                          {tenantRoles.map(tr => (
                            <button key={tr.id} type="button"
                              onClick={() => { setTenantRoleId(tr.id); setRole(null) }}
                              className={roleBtn(tenantRoleId === tr.id)}>
                              {tr.name}
                            </button>
                          ))}
                        </div>
                      ) : (
                        // 커스텀 역할 없으면 기본 목록 표시
                        <div className="grid grid-cols-2 gap-2">
                          {DEFAULT_ROLES.map(opt => (
                            <button key={opt.value} type="button"
                              onClick={() => { setRole(opt.value); setTenantRoleId(null) }}
                              className={roleBtn(role === opt.value)}>
                              {opt.label}
                            </button>
                          ))}
                          <button type="button"
                            onClick={() => { setRole('admin'); setTenantRoleId(null) }}
                            className={roleBtn(role === 'admin')}>
                            관리자
                          </button>
                        </div>
                      )}
                      {role === 'admin' && (
                        <p className="text-[10px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-2.5 py-1.5 rounded-lg border border-amber-200 dark:border-amber-800/40 mt-1.5">
                          관리자 가입은 슈퍼어드민의 승인이 필요합니다.
                        </p>
                      )}
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">이름</label>
                    <input type="text" value={name} onChange={e => setName(e.target.value)}
                      required placeholder="홍길동" className={inputClass} />
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">이메일</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  required className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">비밀번호</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                  required className={inputClass} />
              </div>
              {mode === 'signup' && (
                <div>
                  <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">비밀번호 확인</label>
                  <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                    required className={inputClass} />
                </div>
              )}

              {error && (
                <p className="text-red-500 dark:text-red-400 text-xs bg-red-50 dark:bg-red-950/30 px-3 py-2 rounded-lg border border-red-200 dark:border-red-900/50">
                  {error}
                </p>
              )}

              <div className="flex gap-2 pt-1">
                <button type="submit" disabled={loading}
                  className="flex-1 bg-[var(--color-brand-primary)] text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-[var(--color-brand-primary-hover)] disabled:opacity-50 transition-all duration-200 shadow-[0_2px_8px_rgba(224,92,58,0.3)]">
                  {loading ? '처리 중...' : mode === 'login' ? '로그인' : '가입하기'}
                </button>
                {!hideCancelButton && (
                  <button type="button" onClick={onClose}
                    className="flex-1 border border-[var(--color-border-strong)] text-[var(--color-text-secondary)] rounded-xl py-2.5 text-sm font-medium hover:bg-[var(--color-surface-hover)] transition-all duration-200">
                    취소
                  </button>
                )}
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
