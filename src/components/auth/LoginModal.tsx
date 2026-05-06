import { useState } from 'react'

interface Props {
  onClose: () => void
  onSignIn: (email: string, password: string) => Promise<string | null>
}

export function LoginModal({ onClose, onSignIn }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const err = await onSignIn(email, password)
    setLoading(false)
    if (err) setError(err)
    else onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm">
        <h2 className="text-lg font-bold mb-4">로그인</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">이메일</label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              required className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">비밀번호</label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              required className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          {error && <p className="text-red-500 text-xs">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={loading}
              className="flex-1 bg-blue-600 text-white rounded py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {loading ? '로그인 중...' : '로그인'}
            </button>
            <button type="button" onClick={onClose}
              className="flex-1 border border-gray-300 rounded py-2 text-sm hover:bg-gray-50">
              취소
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
