interface Props {
  year: number
  month: number
}

export function ExportButton({ year, month }: Props) {
  function handleShareUrl() {
    const url = `${window.location.origin}/share?year=${year}&month=${month}`
    navigator.clipboard.writeText(url).then(() => alert('공유 URL이 클립보드에 복사되었습니다.\n' + url))
  }

  return (
    <button
      onClick={handleShareUrl}
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
    >
      <span>🔗</span>
      <span className="hidden sm:inline">공유</span>
    </button>
  )
}
