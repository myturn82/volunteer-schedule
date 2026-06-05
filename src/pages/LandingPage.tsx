import { useNavigate } from 'react-router-dom'
import { ScheduleBackground } from '../components/auth/ScheduleBackground'

export function LandingPage() {
  const navigate = useNavigate()

  const topNavSlot = (
    <button className="lmp-nav-btn" onClick={() => navigate('/auth?tab=login')}>
      로그인
    </button>
  )

  return (
    <ScheduleBackground topNavSlot={topNavSlot}>
      <style>{`
        .lmp-card {
          position:relative; z-index:5; width:100%; max-width:420px;
          background:#fff; border:1px solid rgba(20,23,28,0.07); border-radius:18px;
          padding:28px 28px 26px; margin:auto;
          box-shadow:0 1px 0 rgba(20,23,28,0.03),0 22px 60px -28px rgba(20,23,28,0.22),0 4px 14px -8px rgba(20,23,28,0.10);
        }
      `}</style>
      <div className="lmp-card">
        {/* Brand pill */}
        <div style={{
          display: 'inline-block', fontSize: 11,
          fontFamily: '"JetBrains Mono", monospace',
          padding: '3px 8px', borderRadius: 999,
          background: '#fff', border: '1px solid rgba(20,23,28,0.09)',
          color: 'oklch(0.66 0.16 28)', letterSpacing: '1.2px',
          textTransform: 'uppercase', marginBottom: 14, fontWeight: 700,
        }}>
          SCHEDULER
        </div>

        {/* Headline */}
        <h1 style={{
          fontSize: 28, lineHeight: 1.22, letterSpacing: '-0.8px', fontWeight: 700,
          color: '#14171C', margin: '0 0 12px',
        }}>
          단 한 장의 캘린더로<br />끝내는 팀원 관리
        </h1>

        {/* Subtext */}
        <p style={{
          fontSize: 14, color: '#6B7280', lineHeight: 1.6, margin: '0 0 28px',
        }}>
          조직 개설부터 스케줄 공유까지<br />엑셀보다 빠르게 시작하세요.
        </p>

        {/* CTA buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            onClick={() => navigate('/consent')}
            style={{
              width: '100%', height: 46, background: '#14171C', color: '#fff',
              border: 0, borderRadius: 12, fontFamily: 'inherit', fontSize: 14,
              fontWeight: 600, letterSpacing: '-0.2px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              boxShadow: '0 1px 0 rgba(20,23,28,0.06), 0 8px 20px -8px rgba(20,23,28,0.30)',
            }}
          >
            무료로 시작하기
            <svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 10h12M11 5l5 5-5 5"/>
            </svg>
          </button>
          <button
            onClick={() => navigate('/auth?tab=login')}
            style={{
              width: '100%', height: 42, background: '#fff', color: '#14171C',
              border: '1px solid rgba(20,23,28,0.12)', borderRadius: 12,
              fontFamily: 'inherit', fontSize: 13.5, fontWeight: 600, cursor: 'pointer',
              marginTop: 0,
            }}
          >
            로그인
          </button>
        </div>
      </div>
    </ScheduleBackground>
  )
}
