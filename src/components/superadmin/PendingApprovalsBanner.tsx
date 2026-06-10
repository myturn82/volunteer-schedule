import type { Profile } from '../../types'

export interface PendingMember {
  id: string
  tenant_id: string
  user_id: string
  role: string
  role_id: string | null
  created_at: string
  tenant: { name: string } | null
  profile: { name: string; email: string | null } | null
  tenant_role: { name: string } | null
}

interface Props {
  pendingAdmins: Profile[]
  pendingMembers: PendingMember[]
  selectedMemberIds: Set<string>
  approving: boolean
  onApproveAdmin: (id: string) => void
  onRejectAdmin: (p: Profile) => void
  onToggleMember: (id: string) => void
  onToggleAll: (checked: boolean) => void
  onApproveSelected: () => void
}

export function PendingApprovalsBanner({
  pendingAdmins, pendingMembers, selectedMemberIds, approving,
  onApproveAdmin, onRejectAdmin, onToggleMember, onToggleAll, onApproveSelected,
}: Props) {
  if (pendingAdmins.length === 0 && pendingMembers.length === 0) return null

  return (
    <div className="space-y-6 mb-6">
      {/* ── 관리자 승인 대기 ── */}
      {pendingAdmins.length > 0 && (
        <div>
          <h2 className="m-0 text-[15px] font-bold tracking-[-0.3px] text-[var(--color-text-secondary)] mb-3 flex items-center gap-2 whitespace-nowrap">
            관리자 승인 대기
            <span className="hub-badge hub-badge-pending">{pendingAdmins.length}</span>
          </h2>
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[18px] overflow-hidden shadow-[var(--shadow-sm)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[var(--color-surface-secondary)] border-b border-[var(--color-border)]">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)]">이름</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)]">이메일</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)]">가입일</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {pendingAdmins.map(p => (
                  <tr key={p.id} className="hover:bg-[var(--color-surface-hover)]">
                    <td className="px-4 py-3 font-medium text-[var(--color-text-primary)]">{p.name}</td>
                    <td className="px-4 py-3 text-[var(--color-text-muted)] text-xs">{p.email ?? '-'}</td>
                    <td className="px-4 py-3 text-[var(--color-text-muted)] text-xs">{p.created_at.slice(0, 10)}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => onApproveAdmin(p.id)}
                          className="px-3 py-1 text-xs font-medium rounded-lg bg-green-500 text-white hover:bg-green-600 transition-colors"
                        >
                          승인
                        </button>
                        <button
                          onClick={() => onRejectAdmin(p)}
                          className="px-3 py-1 text-xs font-medium rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                        >
                          거절
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── 승인 대기 (일반 회원) ── */}
      {pendingMembers.length > 0 && (
        <div>
          <div className="flex items-center gap-3 mb-3 flex-wrap">
            <h2 className="m-0 text-[15px] font-bold tracking-[-0.3px] text-[var(--color-text-secondary)] flex items-center gap-2 whitespace-nowrap">
              승인 대기
              <span className="hub-badge hub-badge-pending">{pendingMembers.length}</span>
            </h2>
            <button
              disabled={selectedMemberIds.size === 0 || approving}
              onClick={onApproveSelected}
              className="ml-auto px-4 py-2 text-sm font-semibold rounded-xl bg-green-500 text-white hover:bg-green-600 disabled:opacity-40 transition-colors"
            >
              {approving ? '처리 중...' : `선택 승인${selectedMemberIds.size > 0 ? ` (${selectedMemberIds.size})` : ''}`}
            </button>
          </div>
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[18px] overflow-hidden shadow-[var(--shadow-sm)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[var(--color-surface-secondary)] border-b border-[var(--color-border)]">
                  <th className="px-4 py-3">
                    <input
                      type="checkbox"
                      className="accent-[var(--color-brand-primary)] w-4 h-4"
                      checked={selectedMemberIds.size === pendingMembers.length && pendingMembers.length > 0}
                      onChange={e => onToggleAll(e.target.checked)}
                    />
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)]">이름</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)] hidden sm:table-cell">이메일</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)]">조직</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)] hidden md:table-cell">역할</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)] hidden md:table-cell">신청일시</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {pendingMembers.map(m => (
                  <tr
                    key={m.id}
                    className={`hover:bg-[var(--color-surface-hover)] cursor-pointer ${selectedMemberIds.has(m.id) ? 'bg-[var(--color-brand-primary)]/5' : ''}`}
                    onClick={() => onToggleMember(m.id)}
                  >
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        className="accent-[var(--color-brand-primary)] w-4 h-4"
                        checked={selectedMemberIds.has(m.id)}
                        onChange={() => onToggleMember(m.id)}
                      />
                    </td>
                    <td className="px-4 py-3 font-medium text-[var(--color-text-primary)]">{m.profile?.name ?? '-'}</td>
                    <td className="px-4 py-3 text-[var(--color-text-muted)] text-xs hidden sm:table-cell">{m.profile?.email ?? '-'}</td>
                    <td className="px-4 py-3 text-[var(--color-text-secondary)] text-xs">{m.tenant?.name ?? '-'}</td>
                    <td className="px-4 py-3 text-[var(--color-text-muted)] text-xs hidden md:table-cell">{m.tenant_role?.name ?? m.role ?? '-'}</td>
                    <td className="px-4 py-3 text-[var(--color-text-muted)] text-xs hidden md:table-cell">{m.created_at.slice(0, 16).replace('T', ' ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
