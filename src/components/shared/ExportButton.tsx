import html2canvas from 'html2canvas'

interface Props {
  targetId: string
  year: number
  month: number
}

export function ExportButton({ targetId, year, month }: Props) {
  async function handleImageSave() {
    const el = document.getElementById(targetId)
    if (!el) return
    const canvas = await html2canvas(el, { scale: 2 })
    const link = document.createElement('a')
    link.download = `volunteer-schedule-${year}-${String(month).padStart(2, '0')}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  function handleShareUrl() {
    const url = `${window.location.origin}/share?year=${year}&month=${month}`
    navigator.clipboard.writeText(url).then(() => alert('공유 URL이 클립보드에 복사되었습니다.\n' + url))
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={handleImageSave}
        className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50 flex items-center gap-1"
      >
        📷 이미지 저장
      </button>
      <button
        onClick={handleShareUrl}
        className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50 flex items-center gap-1"
      >
        🔗 공유 URL
      </button>
    </div>
  )
}
