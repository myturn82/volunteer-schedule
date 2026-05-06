import { useSearchParams } from 'react-router-dom'
import { useSchedule } from '../hooks/useSchedule'
import { ScheduleHeader } from '../components/schedule/ScheduleHeader'
import { ScheduleGrid } from '../components/schedule/ScheduleGrid'
import { Legend } from '../components/schedule/Legend'

export function SharePage() {
  const [params] = useSearchParams()
  const year = parseInt(params.get('year') ?? String(new Date().getFullYear()))
  const month = parseInt(params.get('month') ?? String(new Date().getMonth() + 1))

  const { assignments, slotSettings, scheduleRules, dateOverrides, loading } = useSchedule(year, month)

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="bg-white rounded-lg shadow p-4 max-w-full">
        <div className="mb-2 text-xs text-gray-400 text-right">읽기 전용 공유 뷰</div>
        <ScheduleHeader year={year} month={month} onPrev={() => {}} onNext={() => {}} />
        <Legend />
        {loading ? (
          <div className="flex items-center justify-center h-64 text-gray-400">로딩 중...</div>
        ) : (
          <ScheduleGrid
            year={year} month={month}
            assignments={assignments} slotSettings={slotSettings}
            scheduleRules={scheduleRules} dateOverrides={dateOverrides}
            highlightName={null}
            onCellClick={() => {}}
          />
        )}
      </div>
    </div>
  )
}
