import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useTenant } from '../contexts/TenantContext'
import { useAuth } from '../hooks/useAuth'
import type { Tenant } from '../types'

function getGreeting() {
  const h = new Date().getHours()
  if (h >= 6 && h < 12) return '좋은 아침이에요'
  if (h < 18) return '좋은 오후예요'
  if (h < 22) return '좋은 저녁이에요'
  return '안녕하세요'
}

function ChevronRight() {
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="m8 4 6 6-6 6" />
    </svg>
  )
}

function LogoutIcon() {
  return (
    <svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 4h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-3" />
      <path d="M9 7 6 10l3 3M6 10h7" />
    </svg>
  )
}

const TINTS = [
  { bg: 'oklch(0.93 0.06 28)',  ink: 'oklch(0.45 0.13 28)' },
  { bg: 'oklch(0.92 0.05 265)', ink: 'oklch(0.44 0.12 265)' },
  { bg: 'oklch(0.92 0.05 160)', ink: 'oklch(0.40 0.10 160)' },
  { bg: 'oklch(0.93 0.07 75)',  ink: 'oklch(0.44 0.11 60)' },
]

const MODE_LABELS: Record<string, string> = {
  '회원공유': '회원공유', '회원선택': '회원공유',
  '회원개별': '회원개별',
  '비회원': '비회원', '직접입력': '비회원',
}

interface OrgCardProps {
  name: string
  roleLabel: string
  isAdmin: boolean
  mode?: string
  position?: string
  pendingCount?: number
  memberCount?: number
  assignmentCount?: number
  tintIdx: number
  onClick: () => void
  onPendingClick?: () => void
}

function OrgCard({ name, roleLabel, isAdmin, mode, position, pendingCount, memberCount, assignmentCount, tintIdx, onClick, onPendingClick }: OrgCardProps) {
  const [hovered, setHovered] = useState(false)
  const initial = name.charAt(0)
  const tint = TINTS[tintIdx % TINTS.length]

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        width: '100%',
        textAlign: 'left',
        padding: '14px 16px',
        background: '#FFFFFF',
        border: `1px solid ${hovered ? 'rgba(20,23,28,0.12)' : 'rgba(20,23,28,0.07)'}`,
        borderRadius: 20,
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        cursor: 'pointer',
        font: 'inherit',
        color: 'inherit',
        boxShadow: hovered
          ? '0 1px 0 rgba(20,23,28,0.04), 0 16px 30px -16px rgba(20,23,28,0.18)'
          : '0 1px 0 rgba(20,23,28,0.03), 0 1px 2px rgba(20,23,28,0.03)',
        transform: hovered ? 'translateY(-2px)' : 'none',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease',
      }}
    >
      {/* Avatar tile */}
      <div className="tsp-avatar" style={{
        width: 52, height: 52, borderRadius: 14, flexShrink: 0,
        background: tint.bg,
        display: 'grid', placeItems: 'center',
        fontSize: 21, fontWeight: 700,
        color: tint.ink,
        letterSpacing: -0.6,
      }}>
        {initial}
      </div>

      {/* Body */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
        <div className="tsp-orgname" style={{
          fontSize: 16.5, fontWeight: 700, letterSpacing: -0.4, color: '#14171C',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {name}
        </div>
        <div className="tsp-orgmeta" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 500, flexWrap: 'wrap' }}>
          {/* Role pill */}
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '2px 9px 2px 7px', borderRadius: 999,
            fontSize: 11.5, fontWeight: 600, letterSpacing: -0.1,
            background: isAdmin ? 'oklch(0.95 0.04 28)' : 'rgba(20,23,28,0.05)',
            color: isAdmin ? 'oklch(0.38 0.13 28)' : '#353A44',
            whiteSpace: 'nowrap',
          }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor', flexShrink: 0 }} />
            {roleLabel}
          </span>
          {mode && MODE_LABELS[mode] && (
            <span style={{
              display: 'inline-flex', alignItems: 'center',
              padding: '1px 7px', borderRadius: 999,
              fontSize: 11, fontWeight: 500,
              background: 'rgba(20,23,28,0.05)', color: '#6B7280',
              whiteSpace: 'nowrap',
            }}>
              {MODE_LABELS[mode]}
            </span>
          )}
          {position && <span style={{ color: '#6B7280', whiteSpace: 'nowrap' }}>{position}</span>}
          {!!pendingCount && (
            <span
              onClick={onPendingClick ? e => { e.stopPropagation(); onPendingClick() } : undefined}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '2px 8px', borderRadius: 999,
                fontSize: 11, fontWeight: 600,
                background: 'oklch(0.96 0.06 40)', color: 'oklch(0.50 0.18 35)',
                whiteSpace: 'nowrap',
                cursor: onPendingClick ? 'pointer' : 'default',
                textDecoration: onPendingClick ? 'underline' : 'none',
              }}
            >
              승인대기 {pendingCount}건
            </span>
          )}
        </div>
        {(memberCount !== undefined || assignmentCount !== undefined) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {memberCount !== undefined && (
              <span style={{ fontSize: 11, color: '#8A8F99' }}>
                멤버 <strong style={{ color: '#353A44', fontWeight: 600 }}>{memberCount}명</strong>
              </span>
            )}
            {assignmentCount !== undefined && (
              <span style={{ fontSize: 11, color: '#8A8F99' }}>
                이번 달 <strong style={{ color: '#353A44', fontWeight: 600 }}>{assignmentCount}건</strong>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Arrow */}
      <div style={{
        flexShrink: 0, width: 30, height: 30, borderRadius: 9,
        display: 'grid', placeItems: 'center',
        background: hovered ? '#14171C' : 'transparent',
        color: hovered ? '#fff' : '#8A8F99',
        transform: hovered ? 'translateX(2px)' : 'none',
        transition: 'transform 0.15s, background 0.15s, color 0.15s',
      }}>
        <ChevronRight />
      </div>
    </button>
  )
}

export function TenantSelectPage() {
  const { memberships, setTenant } = useTenant()
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [allTenants, setAllTenants] = useState<Tenant[]>([])
  const [pendingCounts, setPendingCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(false)
  const [memberNotice, setMemberNotice] = useState<string | null>(null)
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({})
  const [assignmentCounts, setAssignmentCounts] = useState<Record<string, number>>({})

  useEffect(() => {
    if (!profile) return
    const notice = localStorage.getItem('vs_notice_already_member') ?? localStorage.getItem('vs_notice_join_requested')
    if (notice) {
      localStorage.removeItem('vs_notice_already_member')
      localStorage.removeItem('vs_notice_join_requested')
      setMemberNotice(notice)
    }
  }, [profile?.id])

  useEffect(() => {
    if (!profile?.is_super_admin) return
    setLoading(true)
    const now = new Date()
    Promise.all([
      supabase.from('tenants').select('*').order('name'),
      supabase.from('tenant_members').select('tenant_id, is_approved'),
      supabase.from('assignments').select('tenant_id')
        .eq('year', now.getFullYear())
        .eq('month', now.getMonth() + 1)
        .neq('member_type', 'admin_note'),
    ]).then(([{ data: tenants }, { data: members }, { data: assignments }]) => {
      setAllTenants(tenants ?? [])
      const pending: Record<string, number> = {}
      const memberC: Record<string, number> = {}
      for (const m of members ?? []) {
        if (m.is_approved === false) {
          pending[m.tenant_id] = (pending[m.tenant_id] ?? 0) + 1
        } else {
          memberC[m.tenant_id] = (memberC[m.tenant_id] ?? 0) + 1
        }
      }
      const assignmentC: Record<string, number> = {}
      for (const a of assignments ?? []) {
        assignmentC[a.tenant_id] = (assignmentC[a.tenant_id] ?? 0) + 1
      }
      setPendingCounts(pending)
      setMemberCounts(memberC)
      setAssignmentCounts(assignmentC)
      setLoading(false)
    })
  }, [profile?.is_super_admin])

  const now = new Date()
  const monthStr = String(now.getMonth() + 1).padStart(2, '0')
  const greeting = getGreeting()
  const displayName = profile?.name ?? ''
  const displayEmail = profile?.email ?? ''

  interface ItemData {
    id: string
    name: string
    roleLabel: string
    isAdmin: boolean
    mode?: string
    position?: string
    pendingCount?: number
    memberCount?: number
    assignmentCount?: number
    onClick: () => void
  }

  const pageContent = (items: ItemData[]) => (
    <div style={{
      position: 'relative',
      minHeight: '100dvh',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      background: '#F4F1EA',
      fontFamily: '"Pretendard Variable", Pretendard, system-ui, -apple-system, sans-serif',
      WebkitFontSmoothing: 'antialiased',
      color: '#14171C',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&display=swap');
        @media (max-width: 540px) {
          .tsp-topbar { padding: 16px 18px !important; }
          .tsp-wrap { padding: 8px 18px 22px !important; align-items: flex-start !important; padding-top: 10px !important; }
          .tsp-h1 { font-size: 30px !important; letter-spacing: -1.2px !important; }
          .tsp-lede { display: none !important; }
          .tsp-greeting { margin-bottom: 14px !important; }
          .tsp-orglist { gap: 8px !important; }
          .tsp-avatar { width: 48px !important; height: 48px !important; font-size: 19px !important; border-radius: 12px !important; }
          .tsp-orgname { font-size: 15.5px !important; }
          .tsp-digit { font-size: 200px !important; bottom: -60px !important; right: -24px !important; }
          .tsp-foot { padding: 12px 16px !important; font-size: 11px !important; }
          .tsp-foot-mail { display: none !important; }
          .tsp-foot-dot2 { display: none !important; }
        }
        @media (max-width: 380px) {
          .tsp-orgmeta { gap: 6px !important; }
        }
      `}</style>

      {/* Graph-paper grid background */}
      <div aria-hidden="true" style={{
        position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none',
        backgroundImage: 'linear-gradient(to right, rgba(20,23,28,0.07) 1px, transparent 1px), linear-gradient(to bottom, rgba(20,23,28,0.07) 1px, transparent 1px)',
        backgroundSize: '56px 56px',
        maskImage: 'radial-gradient(ellipse 80% 70% at 50% 38%, #000 0%, transparent 78%)',
        WebkitMaskImage: 'radial-gradient(ellipse 80% 70% at 50% 38%, #000 0%, transparent 78%)',
      }} />

      {/* Month watermark */}
      <div aria-hidden="true" className="tsp-digit" style={{
        position: 'absolute', bottom: -90, right: -40, zIndex: 0,
        fontSize: 320, lineHeight: 0.85, fontWeight: 800, letterSpacing: -8,
        color: 'transparent',
        WebkitTextStroke: '1.5px rgba(20,23,28,0.06)',
        userSelect: 'none', pointerEvents: 'none',
        fontFamily: '"JetBrains Mono", monospace',
      }}>
        {monthStr}<span style={{ fontSize: '0.30em', marginLeft: -8 }}>月</span>
      </div>

      {/* Top bar */}
      <header className="tsp-topbar" style={{
        position: 'relative', zIndex: 5,
        padding: '20px 28px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="30" height="30" style={{ flexShrink: 0, borderRadius: 9, overflow: 'hidden' }}>
            <rect width="512" height="512" rx="112" fill="#FBF9F4"/>
            <rect x="64"     y="142.8" width="55.67" height="68.8" rx="16" fill="oklch(0.85 0.10 70)"/>
            <rect x="129.67" y="142.8" width="55.67" height="68.8" rx="16" fill="oklch(0.66 0.16 28)"/>
            <rect x="326.67" y="142.8" width="55.67" height="68.8" rx="16" fill="oklch(0.78 0.09 230)"/>
            <rect x="392.33" y="142.8" width="55.67" height="68.8" rx="16" fill="oklch(0.75 0.10 160)"/>
            <rect x="64"     y="221.6" width="55.67" height="68.8" rx="16" fill="oklch(0.72 0.10 290)"/>
            <rect x="129.67" y="221.6" width="55.67" height="68.8" rx="16" fill="oklch(0.85 0.10 70)"/>
            <rect x="326.67" y="221.6" width="55.67" height="68.8" rx="16" fill="oklch(0.66 0.16 28)"/>
            <rect x="392.33" y="221.6" width="55.67" height="68.8" rx="16" fill="oklch(0.78 0.09 230)"/>
            <rect x="64"     y="300.4" width="55.67" height="68.8" rx="16" fill="oklch(0.75 0.10 160)"/>
            <rect x="129.67" y="300.4" width="55.67" height="68.8" rx="16" fill="oklch(0.72 0.10 290)"/>
            <rect x="326.67" y="300.4" width="55.67" height="68.8" rx="16" fill="oklch(0.85 0.10 70)"/>
            <rect x="392.33" y="300.4" width="55.67" height="68.8" rx="16" fill="oklch(0.66 0.16 28)"/>
            <rect x="64"     y="379.2" width="55.67" height="68.8" rx="16" fill="oklch(0.78 0.09 230)"/>
            <rect x="129.67" y="379.2" width="55.67" height="68.8" rx="16" fill="oklch(0.75 0.10 160)"/>
            <rect x="326.67" y="379.2" width="55.67" height="68.8" rx="16" fill="oklch(0.72 0.10 290)"/>
            <rect x="392.33" y="379.2" width="55.67" height="68.8" rx="16" fill="oklch(0.85 0.10 70)"/>
          </svg>
          <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: -0.4, whiteSpace: 'nowrap' }}>스케줄러</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {profile?.is_super_admin && (
            <button
              onClick={() => navigate('/superadmin')}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                fontSize: 12, fontWeight: 500, fontFamily: 'inherit', color: '#6B7280',
                padding: '5px 10px', borderRadius: 9,
                border: '1px solid rgba(20,23,28,0.07)',
                background: '#FFFFFF', cursor: 'pointer', whiteSpace: 'nowrap',
                boxShadow: '0 1px 0 rgba(20,23,28,0.03)',
              }}
            >
              <svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <rect x="2" y="7" width="7" height="11" rx="1.5"/>
                <rect x="11" y="2" width="7" height="16" rx="1.5"/>
              </svg>
              조직관리
            </button>
          )}
          <button
            onClick={signOut}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              fontSize: 12, fontWeight: 500, fontFamily: 'inherit', padding: '5px 10px',
              background: '#FFFFFF', color: '#353A44',
              border: '1px solid rgba(20,23,28,0.07)', borderRadius: 9,
              cursor: 'pointer', whiteSpace: 'nowrap',
              boxShadow: '0 1px 0 rgba(20,23,28,0.03)',
              transition: 'background 0.12s, border-color 0.12s',
            }}
          >
            <LogoutIcon />
            로그아웃
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="tsp-wrap" style={{
        position: 'relative', zIndex: 4,
        flex: 1,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '12px 24px 28px',
        minHeight: 0,
      }}>
        <div style={{ width: '100%', maxWidth: 540 }}>

          {/* Greeting pill */}
          <div className="tsp-greeting" style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '6px 13px 6px 8px',
            background: '#FFFFFF', border: '1px solid rgba(20,23,28,0.07)',
            borderRadius: 999, fontSize: 12.5, color: '#353A44', fontWeight: 500,
            marginBottom: 16,
            boxShadow: '0 1px 0 rgba(20,23,28,0.03), 0 8px 22px -14px rgba(20,23,28,0.18)',
            whiteSpace: 'nowrap',
          }}>
            <span style={{
              width: 22, height: 22, borderRadius: '50%',
              background: 'oklch(0.95 0.04 28)',
              display: 'grid', placeItems: 'center', fontSize: 12,
            }}>👋</span>
            <span><strong style={{ fontWeight: 700, color: '#14171C' }}>{displayName}</strong>님, {greeting}</span>
          </div>

          {/* Already-member notice */}
          {memberNotice && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
              marginBottom: 16, padding: '10px 14px', borderRadius: 12,
              background: '#eff6ff', border: '1px solid #bfdbfe',
              fontSize: 13, color: '#1d4ed8',
            }}>
              <span>{memberNotice}</span>
              <button onClick={() => setMemberNotice(null)} style={{
                flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer',
                color: '#93c5fd', padding: 0, display: 'grid', placeItems: 'center',
              }}>
                <svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M5 5l10 10M15 5L5 15"/>
                </svg>
              </button>
            </div>
          )}

          {/* Headline */}
          <h1 className="tsp-h1" style={{ margin: '0 0 12px', fontSize: 38, lineHeight: 1.12, letterSpacing: -1.6, fontWeight: 700, color: '#14171C' }}>
            오늘은 어디로<br />가볼까요<span style={{ color: 'oklch(0.66 0.16 28)' }}>?</span>
          </h1>
          <p className="tsp-lede" style={{ margin: '0 0 26px', fontSize: 15, lineHeight: 1.55, color: '#6B7280', maxWidth: 430 }}>
            내가 속한 조직을 선택해서 들어가세요. 역할에 따라 다른 화면이 열려요.
          </p>

          {/* Super-admin summary stats */}
          {profile?.is_super_admin && !loading && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
              {([
                { label: '전체 조직', value: `${allTenants.length}개`, highlight: false },
                { label: '총 멤버', value: `${Object.values(memberCounts).reduce((s, v) => s + v, 0)}명`, highlight: false },
                { label: '승인 대기', value: `${Object.values(pendingCounts).reduce((s, v) => s + v, 0)}건`, highlight: Object.values(pendingCounts).some(v => v > 0) },
              ] as { label: string; value: string; highlight: boolean }[]).map(({ label, value, highlight }) => (
                <div key={label} style={{
                  flex: '1 1 90px', padding: '10px 14px',
                  background: '#FFFFFF',
                  border: `1px solid ${highlight ? 'oklch(0.88 0.07 50)' : 'rgba(20,23,28,0.07)'}`,
                  borderRadius: 14,
                  boxShadow: '0 1px 0 rgba(20,23,28,0.03)',
                }}>
                  <div style={{ fontSize: 10.5, color: '#8A8F99', fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.5, color: highlight ? 'oklch(0.50 0.18 35)' : '#14171C' }}>{value}</div>
                </div>
              ))}
            </div>
          )}

          {/* List header */}
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{
              fontSize: 11, fontWeight: 600, letterSpacing: 0.8, textTransform: 'uppercase',
              color: '#8A8F99', fontFamily: '"JetBrains Mono", monospace',
            }}>내 조직</span>
            <span style={{ fontSize: 11, color: '#8A8F99', fontFamily: '"JetBrains Mono", monospace', letterSpacing: 0.4 }}>
              {items.length}개
            </span>
          </div>

          {/* Org list */}
          {loading ? (
            <div style={{ padding: '40px 0', textAlign: 'center', color: '#8A8F99', fontSize: 14 }}>로딩 중...</div>
          ) : items.length === 0 ? (
            <div style={{ padding: '40px 0', textAlign: 'center', color: '#8A8F99', fontSize: 14 }}>소속된 조직이 없습니다.</div>
          ) : (
            <div className="tsp-orglist" style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {items.map((item, idx) => (
                <OrgCard
                  key={item.id}
                  name={item.name}
                  roleLabel={item.roleLabel}
                  isAdmin={item.isAdmin}
                  mode={item.mode}
                  position={item.position}
                  pendingCount={item.pendingCount}
                  memberCount={item.memberCount}
                  assignmentCount={item.assignmentCount}
                  tintIdx={idx}
                  onClick={item.onClick}
                  onPendingClick={(item as { onPendingClick?: () => void }).onPendingClick}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="tsp-foot" style={{
        position: 'relative', zIndex: 5,
        borderTop: '1px solid rgba(20,23,28,0.07)',
        padding: '14px 28px',
        display: 'flex', alignItems: 'center', gap: 10,
        fontSize: 12, color: '#8A8F99',
      }}>
        <span style={{ color: '#353A44', fontWeight: 600 }}>{displayName}</span>
        <span style={{ width: 3, height: 3, borderRadius: '50%', background: '#B8BBC2', flexShrink: 0 }} />
        <span className="tsp-foot-mail" style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11.5 }}>{displayEmail}</span>
      </footer>
    </div>
  )

  // Super admin: show all tenants
  if (profile?.is_super_admin) {
    const items = allTenants.map(t => ({
      id: t.id,
      name: t.name,
      roleLabel: '슈퍼관리자',
      isAdmin: true,
      mode: t.settings?.tenant_mode ?? '회원선택',
      pendingCount: pendingCounts[t.id] ?? 0,
      memberCount: memberCounts[t.id] ?? 0,
      assignmentCount: assignmentCounts[t.id] ?? 0,
      onClick: () => { setTenant(t, 'admin'); navigate('/') },
      onPendingClick: (pendingCounts[t.id] ?? 0) > 0
        ? () => { setTenant(t, 'admin'); navigate(`/admin?org=${t.id}&tab=pending`) }
        : undefined,
    }))
    return pageContent(items)
  }

  // Regular user: own memberships
  const items = memberships.map(m => ({
    id: m.id,
    name: m.tenant.name,
    roleLabel: m.role === 'admin' ? '관리자' : '멤버',
    isAdmin: m.role === 'admin',
    mode: m.tenant.settings?.tenant_mode ?? '회원선택',
    position: m.tenant_role?.name,
    onClick: () => { setTenant(m.tenant, m.role); navigate('/') },
  }))
  return pageContent(items)
}
