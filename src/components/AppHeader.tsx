import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useTenant } from '../contexts/TenantContext'
import { DashboardNav } from './DashboardNav'
import { ProfileModal } from './auth/ProfileModal'
import { JoinOrgModal } from './modals/JoinOrgModal'

interface AppHeaderProps {
  funcMenuItems?: (closeMenu: () => void) => React.ReactNode
  leftSlot?: React.ReactNode
  memberSelectSlot?: React.ReactNode
  rightSlot?: React.ReactNode
  roleLabel?: string
  onShowLogin?: () => void
}

export function AppHeader({ funcMenuItems, leftSlot, memberSelectSlot, rightSlot, roleLabel, onShowLogin }: AppHeaderProps) {
  const navigate = useNavigate()
  const { profile, signOut, deleteAccount, linkGoogle, linkKakao, getIdentities } = useAuth()
  const { tenant, tenantRole, memberships, resetTenantSelection, reloadMemberships } = useTenant()
  const [showFuncMenu, setShowFuncMenu] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [showJoinOrg, setShowJoinOrg] = useState(false)
  const [showWithdrawModal, setShowWithdrawModal] = useState(false)
  const [joinSuccessMsg, setJoinSuccessMsg] = useState<string | null>(null)

  const isPrivileged = profile?.is_super_admin || tenantRole === 'admin'
  const showHamburger = isPrivileged && (!!profile?.is_super_admin || !!funcMenuItems)

  const menuBtn = 'w-full text-left px-3 py-2 text-sm rounded-xl text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] transition-colors'
  const sep = <div className="h-px bg-[var(--color-border)] mx-1 my-1" />

  return (
    <>
      <div className="relative bg-[var(--color-surface)] border-b border-[var(--color-border)]">
        <div className="flex items-center justify-between gap-2 px-3 py-3 sm:px-5">

          {/* Left: hamburger + leftSlot + memberSelectSlot */}
          <div className="flex items-center gap-1.5">
            {showHamburger && (
              <button
                onClick={() => setShowFuncMenu(v => !v)}
                aria-label="기능 메뉴"
                className="w-8 h-8 flex items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] transition-all"
              >
                {showFuncMenu
                  ? <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 5l10 10M15 5L5 15"/></svg>
                  : <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 5h14M3 10h14M3 15h14"/></svg>
                }
              </button>
            )}
            {leftSlot}
            {memberSelectSlot}
          </div>

          {/* Right: rightSlot + name/badge + avatar */}
          <div className="flex items-center gap-1.5">
            {rightSlot}
            {profile && (
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-semibold text-[var(--color-text-primary)] max-w-[80px] truncate">{profile.name}</span>
                {roleLabel && (
                  <span className="text-xs text-[var(--color-text-muted)] bg-[var(--color-surface-secondary)] px-2 py-0.5 rounded-lg border border-[var(--color-border)] whitespace-nowrap hidden sm:block">
                    {roleLabel}
                  </span>
                )}
              </div>
            )}
            {profile ? (
              <button
                onClick={() => setShowUserMenu(v => !v)}
                aria-label="사용자 메뉴"
                className="w-8 h-8 flex items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] transition-all"
              >
                {showUserMenu
                  ? <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 5l10 10M15 5L5 15"/></svg>
                  : <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="10" cy="7" r="3" strokeWidth="2"/><path d="M4 17c0-3.314 2.686-6 6-6s6 2.686 6 6" strokeWidth="2" strokeLinecap="round"/></svg>
                }
              </button>
            ) : (
              onShowLogin && (
                <button
                  onClick={onShowLogin}
                  className="px-3 py-1.5 text-sm font-semibold rounded-xl bg-[var(--color-brand-primary)] text-white hover:bg-[var(--color-brand-primary-hover)] transition-all"
                >
                  로그인
                </button>
              )
            )}
          </div>
        </div>

        {/* Hamburger dropdown */}
        {showFuncMenu && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowFuncMenu(false)} />
            <div className="absolute top-full left-3 sm:left-5 mt-1 w-52 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-lg z-50 overflow-hidden">
              <div className="p-2">
                {profile?.is_super_admin && (
                  <>
                    <button onClick={() => { navigate('/superadmin'); setShowFuncMenu(false) }} className={menuBtn}>
                      <span className="flex items-center gap-2.5">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                        조직관리
                      </span>
                    </button>
                    {sep}
                  </>
                )}
                <button onClick={() => { navigate('/admin'); setShowFuncMenu(false) }} className={menuBtn}>
                  <span className="flex items-center gap-2.5">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></svg>
                    관리자대시보드
                  </span>
                </button>
                {funcMenuItems && sep}
                {funcMenuItems?.(() => setShowFuncMenu(false))}
              </div>
            </div>
          </>
        )}

        {/* User menu dropdown */}
        {showUserMenu && profile && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
            <div className="absolute top-full right-3 sm:right-5 mt-1 w-52 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-lg z-50 overflow-hidden">
              <div className="px-3 py-2.5 border-b border-[var(--color-border)]">
                <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">{profile.name}</p>
              </div>
              <div className="p-2">
                <button onClick={() => { setShowProfile(true); setShowUserMenu(false) }} className={menuBtn}>
                  <span className="flex items-center gap-2.5">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                    계정 연동
                  </span>
                </button>
                {sep}
                {(memberships.length > 1 || profile?.is_super_admin) && (
                  <button onClick={() => { resetTenantSelection(); setShowUserMenu(false) }} className={menuBtn}>
                    <span className="flex items-center gap-2.5">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>
                      조직 변경
                    </span>
                  </button>
                )}
                {!profile?.is_super_admin && (
                  <button onClick={() => { setShowJoinOrg(true); setShowUserMenu(false) }} className={menuBtn}>
                    <span className="flex items-center gap-2.5">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 12h8M12 8v8"/></svg>
                      다른 조직 가입
                    </span>
                  </button>
                )}
                {sep}
                <button onClick={() => { signOut(); setShowUserMenu(false) }} className={menuBtn}>
                  <span className="flex items-center gap-2.5">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                    로그아웃
                  </span>
                </button>
                <button onClick={() => { setShowWithdrawModal(true); setShowUserMenu(false) }} className={menuBtn}>
                  <span className="flex items-center gap-2.5">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="17" y1="8" x2="23" y2="14"/><line x1="23" y1="8" x2="17" y2="14"/></svg>
                    회원탈퇴
                  </span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {joinSuccessMsg && (
        <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-green-50 dark:bg-green-950/30 border-b border-green-200 dark:border-green-800 text-sm text-green-700 dark:text-green-300">
          <span>{joinSuccessMsg}</span>
          <button onClick={() => setJoinSuccessMsg(null)} className="shrink-0 opacity-60 hover:opacity-100 text-base leading-none">✕</button>
        </div>
      )}

      {isPrivileged && <DashboardNav />}

      {showProfile && profile && (
        <ProfileModal
          profile={profile}
          onClose={() => setShowProfile(false)}
          linkGoogle={linkGoogle}
          linkKakao={linkKakao}
          getIdentities={getIdentities}
        />
      )}

      {showJoinOrg && profile && (
        <JoinOrgModal
          userId={profile.id}
          onClose={() => setShowJoinOrg(false)}
          onSuccess={() => {
            setShowJoinOrg(false)
            setJoinSuccessMsg('가입 신청이 완료됐습니다. 관리자 승인 후 이용하실 수 있습니다.')
          }}
        />
      )}

      {showWithdrawModal && (
        <>
          <div className="fixed inset-0 z-50 bg-black/40" onClick={() => setShowWithdrawModal(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-lg w-full max-w-xs p-5 space-y-3">
              <h2 className="text-base font-semibold text-[var(--color-text-primary)]">탈퇴 방식 선택</h2>
              {tenant && memberships.filter(m => m.is_approved).length > 1 && (
                <button
                  onClick={async () => {
                    setShowWithdrawModal(false)
                    const err = await deleteAccount(tenant.id)
                    if (err) alert(err)
                    else await reloadMemberships()
                  }}
                  className="w-full px-4 py-3 text-left rounded-xl border border-[var(--color-border)] hover:bg-[var(--color-surface-hover)] transition-colors"
                >
                  <p className="text-sm font-medium text-[var(--color-text-primary)]">현재 조직 탈퇴</p>
                  <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{tenant.name}에서만 탈퇴합니다. 계정은 유지됩니다.</p>
                </button>
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
    </>
  )
}
