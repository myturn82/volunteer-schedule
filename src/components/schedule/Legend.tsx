const LEGEND_ITEMS = [
  {
    bg: 'bg-white dark:bg-[#1e2028]',
    border: 'border-[var(--color-border)]',
    icon: '☀',
    iconColor: 'text-amber-400',
    label: '햇님타임 (10~18시)',
  },
  {
    bg: 'bg-pink-50 dark:bg-[#2c1a2e]',
    border: 'border-pink-200 dark:border-pink-900/60',
    icon: '★',
    iconColor: 'text-pink-400',
    label: '달님타임 (20~22시)',
  },
  {
    bg: 'bg-slate-100 dark:bg-[#191c24]',
    border: 'border-[var(--color-border)]',
    icon: '—',
    iconColor: 'text-[var(--color-text-muted)]',
    label: 'BREAKTIME',
  },
  {
    bg: 'bg-yellow-100 dark:bg-yellow-950/30',
    border: 'border-yellow-200 dark:border-yellow-900/60',
    icon: '●',
    iconColor: 'text-yellow-500',
    label: '팀장 배정',
  },
  {
    bg: 'bg-blue-50 dark:bg-blue-950/30',
    border: 'border-blue-200 dark:border-blue-900/60',
    icon: '토',
    iconColor: 'text-blue-500',
    label: '토요일 운영 (10~14시)',
  },
]

export function Legend() {
  return (
    <div className="flex flex-wrap gap-1.5 mt-3 mb-0.5">
      {LEGEND_ITEMS.map(({ bg, border, icon, iconColor, label }) => (
        <div
          key={label}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border ${bg} ${border}`}
        >
          <span className={`text-[10px] font-bold ${iconColor}`}>{icon}</span>
          <span className="text-[10px] sm:text-[11px] text-[var(--color-text-secondary)] font-medium whitespace-nowrap">
            {label}
          </span>
        </div>
      ))}
    </div>
  )
}
