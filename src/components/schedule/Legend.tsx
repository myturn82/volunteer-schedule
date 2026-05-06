export function Legend() {
  return (
    <div className="flex flex-wrap gap-4 text-xs text-gray-700 mt-3 mb-1 px-1">
      <div className="flex items-center gap-1">
        <span className="inline-block w-4 h-4 rounded bg-pink-100 border border-pink-300" />
        <span>★ 밤타임 (18~22시)</span>
      </div>
      <div className="flex items-center gap-1">
        <span className="inline-block w-4 h-4 rounded bg-yellow-100 border border-yellow-300" />
        <span>★ 토요일 운영 (10~14시)</span>
      </div>
      <div className="flex items-center gap-1">
        <span className="inline-block w-4 h-4 rounded bg-gray-200 border border-gray-300" />
        <span>BREAKTIME (12~13시)</span>
      </div>
    </div>
  )
}
