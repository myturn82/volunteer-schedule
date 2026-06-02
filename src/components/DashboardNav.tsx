import { NavLink } from 'react-router-dom'

export function DashboardNav() {
  const base = 'relative flex items-center gap-[7px] px-4 h-[52px] text-[14px] font-semibold bg-transparent border-0 transition-colors duration-[120ms] whitespace-nowrap'

  return (
    <nav className="flex items-center bg-[var(--color-surface)] border-b border-[var(--color-border)] px-3 sm:px-5 gap-0.5">
      <NavLink
        to="/schedule"
        className={({ isActive }) =>
          `${base} ${isActive ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'}`
        }
      >
        {({ isActive }) => (
          <>
            <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: isActive ? 1 : 0.65 }}>
              <rect x="3" y="4" width="14" height="13" rx="2"/>
              <path d="M3 8h14M7 2v4M13 2v4"/>
            </svg>
            스케줄
            {isActive && (
              <span className="absolute left-3 right-3 -bottom-px h-0.5 rounded-full bg-[var(--color-brand-primary)]" />
            )}
          </>
        )}
      </NavLink>
      <NavLink
        to="/dashboard"
        className={({ isActive }) =>
          `${base} ${isActive ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'}`
        }
      >
        {({ isActive }) => (
          <>
            <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: isActive ? 1 : 0.65 }}>
              <rect x="3" y="3" width="6" height="6" rx="1.5"/>
              <rect x="11" y="3" width="6" height="6" rx="1.5"/>
              <rect x="3" y="11" width="6" height="6" rx="1.5"/>
              <rect x="11" y="11" width="6" height="6" rx="1.5"/>
            </svg>
            대시보드
            {isActive && (
              <span className="absolute left-3 right-3 -bottom-px h-0.5 rounded-full bg-[var(--color-brand-primary)]" />
            )}
          </>
        )}
      </NavLink>
    </nav>
  )
}
