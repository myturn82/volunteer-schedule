import { useState } from 'react'
import type { Assignment, CellState, ModalTarget, Profile } from '../../types'

interface Props {
  target: ModalTarget
  cellState: CellState
  profile: Profile | null
  onClose: () => void
  onAdd: (volunteerName: string, note: string) => Promise<string | null>
  onUpdate: (id: string, volunteerName: string, note: string) => Promise<string | null>
  onDelete: (id: string) => Promise<string | null>
}

export function SlotEditModal({ target, cellState, profile, onClose, onAdd, onUpdate, onDelete }: Props) {
  const [name, setName] = useState('')
  const [note, setNote] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const isAdmin = profile?.role === 'admin'
  const { day, month, year, timeSlot } = target

  function startEdit(a: Assignment) {
    setEditingId(a.id)
    setName(a.volunteer_name)
    setNote(a.note ?? '')
  }

  async function handleAdd() {
    if (!name.trim()) return
    if (!isAdmin && cellState.isFull) { setError('정원이 마감되었습니다'); return }
    setLoading(true)
    const err = await onAdd(name.trim(), note.trim())
    setLoading(false)
    if (err) setError(err)
    else { setName(''); setNote('') }
  }

  async function handleUpdate() {
    if (!editingId || !name.trim()) return
    setLoading(true)
    const err = await onUpdate(editingId, name.trim(), note.trim())
    setLoading(false)
    if (err) setError(err)
    else { setEditingId(null); setName(''); setNote('') }
  }

  async function handleDelete(id: string) {
    setLoading(true)
    const err = await onDelete(id)
    setLoading(false)
    if (err) setError(err)
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold">
            {year}년 {month}월 {day}일 {timeSlot}시
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>

        {cellState.assignments.length > 0 && (
          <div className="mb-4 space-y-2">
            {cellState.assignments.map(a => {
              const canEdit = isAdmin || a.user_id === profile?.id
              return (
                <div key={a.id} className="flex items-center justify-between bg-gray-50 rounded px-3 py-1.5">
                  <span className="text-sm">{a.volunteer_name}{a.note ? ` (${a.note})` : ''}</span>
                  {canEdit && (
                    <div className="flex gap-1">
                      <button onClick={() => startEdit(a)} className="text-xs text-blue-500 hover:underline">수정</button>
                      <button onClick={() => handleDelete(a.id)} className="text-xs text-red-400 hover:underline">삭제</button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {profile ? (
          <div className="space-y-2">
            <input
              value={name} onChange={e => setName(e.target.value)}
              placeholder="봉사자 이름"
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            <input
              value={note} onChange={e => setNote(e.target.value)}
              placeholder="메모 (선택, 예: 2-6)"
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            {error && <p className="text-red-500 text-xs">{error}</p>}
            <div className="flex gap-2">
              <button
                onClick={editingId ? handleUpdate : handleAdd}
                disabled={loading || !name.trim()}
                className="flex-1 bg-blue-600 text-white rounded py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? '저장 중...' : editingId ? '수정' : '추가'}
              </button>
              <button onClick={onClose} className="flex-1 border border-gray-300 rounded py-2 text-sm hover:bg-gray-50">
                닫기
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500 text-center">로그인 후 스케줄을 입력할 수 있습니다.</p>
        )}
      </div>
    </div>
  )
}
