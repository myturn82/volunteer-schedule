interface Props {
  value: string
  onChange: (value: string) => void
}

export function FilterBar({ value, onChange }: Props) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="relative">
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] text-xs pointer-events-none select-none">
          🔍
        </span>
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="봉사자 이름 검색"
          className="pl-7 pr-7 py-1.5 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-surface-secondary)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500/60 transition-all duration-200 w-36 sm:w-52"
        />
        {value && (
          <button
            onClick={() => onChange('')}
            aria-label="검색 초기화"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors text-xs leading-none w-4 h-4 flex items-center justify-center"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  )
}
