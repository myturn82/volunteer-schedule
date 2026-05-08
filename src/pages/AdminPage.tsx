import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useAdmin } from '../hooks/useAdmin'
import { TIME_SLOTS } from '../types'
import type { TimeSlot } from '../types'

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']

type Tab = 'volunteers' | 'rules' | 'dates'

export function AdminPage() {
  const navigate = useNavigate()
  const { profile, loading: authLoading } = useAuth()
  const { profiles, scheduleRules, dateOverrides, loading, updateRole, toggleScheduleRule, addDateOverride, deleteDateOverride } = useAdmin()
  const [tab, setTab] = useState<Tab>('volunteers')
  const [dateForm, setDateForm] = useState({ date: '', type: 'holiday' as 'holiday' | 'special', label: '' })
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null)
  const [saving, setSaving] = useState(false)

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-400">로딩 중...</div>
  }

  if (!profile || profile.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <p className="text-gray-500 dark:text-gray-400 mb-4">관리자 권한이 필요합니다.</p>
          <button onClick={() => navigate('/')} className="text-blue-600 dark:text-blue-400 hover:underline text-sm">
            ← 메인으로 돌아가기
          </button>
        </div>
      </div>
    )
  }

  function getRule(dayOfWeek: number, slot: TimeSlot) {
    return scheduleRules.find(r => r.day_of_week === dayOfWeek && r.time_slot === slot)
  }

  async function handleRoleToggle(targetId: string, currentRole: 'admin' | 'volunteer') {
    const newRole = currentRole === 'admin' ? 'volunteer' : 'admin'
    const err = await updateRole(targetId, newRole)
    if (err) setMessage({ text: err, isError: true })
  }

  async function handleRuleToggle(ruleId: string, currentIsOpen: boolean) {
    const err = await toggleScheduleRule(ruleId, currentIsOpen)
    if (err) setMessage({ text: err, isError: true })
  }

  async function handleDateSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!dateForm.date) return
    setSaving(true)
    const isHoliday = dateForm.type === 'holiday'
    const err = await addDateOverride(dateForm.date, !isHoliday, isHoliday, dateForm.label || null)
    setSaving(false)
    if (err) {
      setMessage({ text: err, isError: true })
    } else {
      setMessage({ text: '저장되었습니다.', isError: false })
      setDateForm({ date: '', type: 'holiday', label: '' })
    }
  }

  async function handleDateDelete(id: string) {
    const err = await deleteDateOverride(id)
    if (err) setMessage({ text: err, isError: true })
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/')}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-sm transition-colors">
              ← 뒤로
            </button>
            <h1 className="text-base font-bold text-gray-900 dark:text-white">관리자 대시보드</h1>
          </div>
          <span className="text-sm text-gray-500 dark:text-gray-400">{profile.name}</span>
        </div>
        <div className="max-w-5xl mx-auto px-4 border-t dark:border-gray-700 flex">
          {(['volunteers', 'rules', 'dates'] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                tab === t
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
              }`}>
              {t === 'volunteers' ? '봉사자 관리' : t === 'rules' ? '스케줄 규칙' : '날짜 설정'}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {message && (
          <div className={`mb-4 p-3 rounded-lg text-sm flex justify-between items-center ${
            message.isError
              ? 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300'
              : 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300'
          }`}>
            <span>{message.text}</span>
            <button onClick={() => setMessage(null)} className="ml-2 opacity-60 hover:opacity-100">✕</button>
          </div>
        )}

        {loading ? (
          <div className="text-center py-16 text-gray-400">로딩 중...</div>
        ) : (
          <>
            {/* 봉사자 관리 */}
            {tab === 'volunteers' && (
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider font-semibold mb-3">
                  봉사자 목록 ({profiles.length}명)
                </p>
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-gray-700/50 border-b dark:border-gray-700">
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400">이름</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 hidden sm:table-cell">이메일</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400">역할</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 hidden sm:table-cell">가입일</th>
                        <th className="px-4 py-3"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {profiles.map(p => (
                        <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                          <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">
                            {p.name}
                            {p.id === profile.id && <span className="ml-1.5 text-xs text-gray-400">(나)</span>}
                          </td>
                          <td className="px-4 py-3 text-gray-500 dark:text-gray-400 hidden sm:table-cell">
                            {p.email ?? '-'}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                              p.role === 'admin'
                                ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300'
                                : 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                            }`}>
                              {p.role === 'admin' ? '관리자' : '봉사자'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-400 dark:text-gray-500 hidden sm:table-cell">
                            {new Date(p.created_at).toLocaleDateString('ko-KR')}
                          </td>
                          <td className="px-4 py-3">
                            {p.id !== profile.id && (
                              <button
                                onClick={() => handleRoleToggle(p.id, p.role)}
                                className="px-2.5 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-300 whitespace-nowrap transition-colors">
                                {p.role === 'admin' ? '봉사자로' : '관리자로'}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 스케줄 규칙 */}
            {tab === 'rules' && (
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider font-semibold mb-3">
                  요일별 운영 규칙
                </p>
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-gray-700/50 border-b dark:border-gray-700">
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400">시간</th>
                        {DAY_LABELS.map(d => (
                          <th key={d} className="px-3 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 text-center">{d}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {TIME_SLOTS.map(slot => (
                        <tr key={slot} className={slot === '12-13' ? 'bg-gray-50/50 dark:bg-gray-700/20' : ''}>
                          <td className="px-4 py-2.5 font-medium text-gray-700 dark:text-gray-300">
                            {slot}
                            {slot === '12-13' && <span className="ml-1 text-xs text-gray-400">휴식</span>}
                          </td>
                          {DAY_LABELS.map((_, dayIdx) => {
                            if (slot === '12-13') return (
                              <td key={dayIdx} className="px-3 py-2.5 text-center">
                                <span className="text-gray-300 dark:text-gray-600 text-xs">—</span>
                              </td>
                            )
                            const rule = getRule(dayIdx, slot)
                            return (
                              <td key={dayIdx} className="px-3 py-2.5 text-center">
                                {rule ? (
                                  <button
                                    onClick={() => handleRuleToggle(rule.id, rule.is_open)}
                                    className={`px-2.5 py-0.5 rounded text-xs font-medium transition-colors ${
                                      rule.is_open
                                        ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 hover:bg-green-200'
                                        : 'bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600'
                                    }`}
                                    title={rule.is_open ? '운영중 — 클릭하여 닫기' : '닫힘 — 클릭하여 열기'}>
                                    {rule.is_open ? '운영' : '닫힘'}
                                  </button>
                                ) : (
                                  <span className="text-gray-300 dark:text-gray-600">-</span>
                                )}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">버튼 클릭 시 즉시 저장됩니다.</p>
              </div>
            )}

            {/* 날짜 설정 */}
            {tab === 'dates' && (
              <div className="space-y-6">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider font-semibold mb-3">날짜 추가</p>
                  <form onSubmit={handleDateSubmit} className="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
                    <div className="flex flex-wrap gap-3 items-end">
                      <div>
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">날짜</label>
                        <input type="date" value={dateForm.date}
                          onChange={e => setDateForm(f => ({ ...f, date: e.target.value }))}
                          required
                          className="border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">유형</label>
                        <select value={dateForm.type}
                          onChange={e => setDateForm(f => ({ ...f, type: e.target.value as 'holiday' | 'special' }))}
                          className="border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                          <option value="holiday">휴관일</option>
                          <option value="special">특별 운영일</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">레이블 (선택)</label>
                        <input type="text" value={dateForm.label}
                          onChange={e => setDateForm(f => ({ ...f, label: e.target.value }))}
                          placeholder="예: 추석연휴"
                          className="border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg px-3 py-1.5 text-sm w-36 focus:outline-none focus:ring-2 focus:ring-blue-400" />
                      </div>
                      <button type="submit" disabled={saving}
                        className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
                        {saving ? '저장 중...' : '추가'}
                      </button>
                    </div>
                  </form>
                </div>

                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider font-semibold mb-3">
                    설정된 날짜 ({dateOverrides.length}건)
                  </p>
                  {dateOverrides.length === 0 ? (
                    <p className="text-sm text-gray-400 dark:text-gray-500">설정된 날짜가 없습니다.</p>
                  ) : (
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50 dark:bg-gray-700/50 border-b dark:border-gray-700">
                            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400">날짜</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400">유형</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400">레이블</th>
                            <th className="px-4 py-3"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                          {dateOverrides.map(d => (
                            <tr key={d.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                              <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{d.date}</td>
                              <td className="px-4 py-3">
                                <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                                  d.is_holiday
                                    ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                                    : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                                }`}>
                                  {d.is_holiday ? '휴관일' : '특별운영'}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{d.label ?? '-'}</td>
                              <td className="px-4 py-3">
                                <button onClick={() => handleDateDelete(d.id)}
                                  className="px-2.5 py-1 text-xs text-red-600 border border-red-200 rounded hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/30 transition-colors">
                                  삭제
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
