// Design system logos — three variants:
//   LogoMonogram  : F · DTS Monogram (시그니처 — 로그인/랜딩)
//   LogoWordmark  : B · Bold + coral Team (가로 한 줄 — 헤더/앱바)
//   LogoIcon      : Paper 앱 아이콘 (파비콘/탑바 아이콘)

const ACCENT = 'oklch(0.66 0.16 28)'

interface MonogramProps {
  dark?: boolean
  className?: string
}

export function LogoMonogram({ dark, className }: MonogramProps) {
  const inkColor = dark ? '#EEF0F4' : 'var(--color-text-primary, #14171C)'
  const muteColor = dark ? '#71767F' : 'var(--color-text-muted, #8A8F99)'
  const accentColor = dark ? 'oklch(0.72 0.16 28)' : ACCENT

  return (
    <div className={className} style={{ display: 'grid', justifyItems: 'start', gap: 9 }}>
      <div style={{
        fontSize: 48,
        fontWeight: 800,
        letterSpacing: -2,
        lineHeight: 0.9,
        color: inkColor,
        fontFamily: '"Pretendard Variable", Pretendard, system-ui, sans-serif',
      }}>
        DTS<span style={{ color: accentColor }}>.</span>
      </div>
      <div style={{
        fontFamily: '"JetBrains Mono", ui-monospace, monospace',
        fontSize: 10.5,
        fontWeight: 600,
        letterSpacing: '4px',
        color: muteColor,
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
      }}>
        Dynamic Team Schedule
      </div>
    </div>
  )
}

interface WordmarkProps {
  dark?: boolean
  size?: 'sm' | 'md'
  thin?: boolean
  className?: string
}

export function LogoWordmark({ dark, size = 'md', thin, className }: WordmarkProps) {
  const fs = size === 'sm' ? 14 : 20
  const fw = thin ? 300 : 800
  const inkColor = dark ? '#EEF0F4' : 'var(--color-text-primary, #14171C)'
  const accentColor = dark ? 'oklch(0.72 0.16 28)' : ACCENT

  return (
    <div className={className} style={{
      fontSize: fs,
      fontWeight: fw,
      letterSpacing: thin ? -0.2 : -0.6,
      whiteSpace: 'nowrap',
      color: inkColor,
      fontFamily: '"Pretendard Variable", Pretendard, system-ui, sans-serif',
    }}>
      Dynamic{' '}
      <span style={{ color: accentColor }}>Team</span>
      {' '}Schedule
    </div>
  )
}

interface B2Props {
  dark?: boolean
  className?: string
}

export function LogoB2({ dark, className }: B2Props) {
  const muteColor = dark ? '#71767F' : 'var(--color-text-muted, #8A8F99)'
  const accentColor = dark ? 'oklch(0.72 0.16 28)' : ACCENT

  return (
    <div className={className} style={{
      fontSize: 22,
      letterSpacing: -0.4,
      whiteSpace: 'nowrap',
      fontFamily: '"Pretendard Variable", Pretendard, system-ui, sans-serif',
      lineHeight: 1,
    }}>
      <span style={{ color: muteColor, fontWeight: 300 }}>dynamic </span>
      <span style={{ color: accentColor, fontWeight: 900 }}>TEAM</span>
      <span style={{ color: muteColor, fontWeight: 300 }}> schedule</span>
    </div>
  )
}

interface IconProps {
  size?: number
  className?: string
}

export function LogoIcon({ size = 32, className }: IconProps) {
  const r = Math.round(size * 0.228)
  const fs = Math.round(size * 0.333)
  const ls = -(fs * 0.034)

  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: r,
        background: ACCENT,
        display: 'grid',
        placeItems: 'center',
        flexShrink: 0,
      }}
    >
      <span style={{
        fontSize: fs,
        fontWeight: 800,
        letterSpacing: ls,
        lineHeight: 1,
        color: '#fff',
        fontFamily: '"Pretendard Variable", Pretendard, system-ui, sans-serif',
        userSelect: 'none',
      }}>
        DTS<span style={{ color: 'rgba(255,255,255,0.6)' }}>.</span>
      </span>
    </div>
  )
}
