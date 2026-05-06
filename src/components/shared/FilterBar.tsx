interface Props {
  value: string
  onChange: (value: string) => void
}

export function FilterBar({ value, onChange }: Props) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-sm font-medium text-gray-700 whitespace-nowrap">이름으로 찾기:</label>
      <input
        type="text" value={value} onChange={e => onChange(e.target.value)}
        placeholder="봉사자 이름 입력"
        className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 w-48"
      />
      {value && (
        <button onClick={() => onChange('')} className="text-gray-400 hover:text-gray-600 text-sm">
          ✕ 초기화
        </button>
      )}
    </div>
  )
}
