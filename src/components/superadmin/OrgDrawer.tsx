import type { Tenant, TenantMode } from '../../types'
import { colorOf, initialsOf } from '../../lib/avatarColor'
import { displayMode } from '../../lib/tenantMode'

export interface DrawerMember {
  id: string
  user_id: string
  role: string
  role_id: string | null
  is_approved: boolean
  created_at: string
  profile: { name: string; email: string | null } | null
  tenant_role: { name: string } | null
}

interface Props {
  tenant: Tenant
  members: DrawerMember[]
  membersLoading: boolean
  onClose: () => void
  isOpen: boolean

  editingNameId: string | null
  editName: string
  setEditName: (v: string) => void
  nameSaving: boolean
  setEditingNameId: (id: string | null) => void
  saveName: (tenant: Tenant) => void

  editingSlugId: string | null
  editSlug: string
  setEditSlug: (v: string) => void
  slugSaving: boolean
  setEditingSlugId: (id: string | null) => void
  saveSlug: (tenant: Tenant) => void

  modeSaving: boolean
  onModeChange: (tenant: Tenant, newMode: TenantMode) => void

  onOpenSchedule: (tenant: Tenant) => void
  onOpenAdmin: (tenant: Tenant) => void

  deletingSaving: boolean
  onDelete: (tenant: Tenant) => void
  onReactivate: (tenant: Tenant) => void

  onApproveMember: (memberId: string) => void
  onRejectMember: (memberId: string) => void
  approvingMemberId: string | null
}

export function OrgDrawer({
  tenant, members, membersLoading, onClose, isOpen,
  editingNameId, editName, setEditName, nameSaving, setEditingNameId, saveName,
  editingSlugId, editSlug, setEditSlug, slugSaving, setEditingSlugId, saveSlug,
  modeSaving, onModeChange,
  onOpenSchedule, onOpenAdmin,
  deletingSaving, onDelete, onReactivate,
  onApproveMember, onRejectMember, approvingMemberId,
}: Props) {
  const { bg, fg } = colorOf(tenant.name)
  const pendingMembers = members.filter(m => !m.is_approved)
  const approvedMembers = members.filter(m => m.is_approved)

  return (
    <aside className={`hub-drawer ${isOpen ? 'is-open' : ''}`}>
      <div className="flex items-start gap-3 mb-4">
        <span className="hub-avatar is-lg" style={{ background: bg, color: fg }}>{initialsOf(tenant.name)}</span>
        <div className="flex-1 min-w-0">
          {editingNameId === tenant.id ? (
            <div className="flex items-center gap-1.5 flex-wrap">
              <input
                value={editName}
                onChange={e => setEditName(e.target.value)}
                className="text-sm font-bold px-2 py-1 rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-text-primary)] w-full max-w-[160px] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-primary)]/30 focus:border-[var(--color-brand-primary)]"
                onKeyDown={e => { if (e.key === 'Enter') saveName(tenant); if (e.key === 'Escape') setEditingNameId(null) }}
                autoFocus
              />
              <button onClick={() => saveName(tenant)} disabled={nameSaving}
                className="px-2 py-1 text-xs bg-[var(--color-brand-primary)] text-white rounded-lg disabled:opacity-40">
                {nameSaving ? '...' : '저장'}
              </button>
              <button onClick={() => setEditingNameId(null)}
                className="px-2 py-1 text-xs border border-[var(--color-border-strong)] text-[var(--color-text-secondary)] rounded-lg">취소</button>
            </div>
          ) : (
            <button
              onClick={() => { setEditingNameId(tenant.id); setEditName(tenant.name); setEditingSlugId(null) }}
              className="text-[16px] font-extrabold tracking-[-0.3px] text-left text-[var(--color-text-primary)] hover:text-[var(--color-brand-primary)] transition-colors truncate block w-full"
            >
              {tenant.name}
            </button>
          )}

          {editingSlugId === tenant.id ? (
            <div className="flex items-center gap-1 mt-1">
              <input
                value={editSlug}
                onChange={e => setEditSlug(e.target.value)}
                className="text-xs font-mono px-2 py-0.5 rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-text-primary)] w-28 focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-primary)]/30 focus:border-[var(--color-brand-primary)]"
                onKeyDown={e => { if (e.key === 'Enter') saveSlug(tenant); if (e.key === 'Escape') setEditingSlugId(null) }}
                autoFocus
              />
              <button onClick={() => saveSlug(tenant)} disabled={slugSaving}
                className="px-1.5 py-0.5 text-xs bg-[var(--color-brand-primary)] text-white rounded-lg disabled:opacity-40">
                {slugSaving ? '...' : '저장'}
              </button>
              <button onClick={() => setEditingSlugId(null)}
                className="px-1.5 py-0.5 text-xs border border-[var(--color-border-strong)] text-[var(--color-text-secondary)] rounded-lg">취소</button>
            </div>
          ) : (
            <button
              onClick={() => { setEditingSlugId(tenant.id); setEditSlug(tenant.slug); setEditingNameId(null) }}
              className="text-[12px] font-medium font-mono text-[var(--color-text-muted)] hover:text-[var(--color-brand-primary)] transition-colors mt-0.5"
            >
              {tenant.slug}
            </button>
          )}

          {tenant.business_type && <p className="text-[11.5px] text-[var(--color-text-muted)] mt-1">{tenant.business_type}</p>}
          {tenant.is_active === false && <span className="hub-badge hub-badge-danger mt-1 inline-block">비활성</span>}
        </div>
        <button onClick={onClose} className="flex-shrink-0 w-7 h-7 rounded-lg grid place-items-center text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]" title="닫기">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      </div>

      {/* ── 운영 모드 ── */}
      <div className="mb-4">
        <label className="block text-[11px] font-bold text-[var(--color-text-muted)] mb-1">공유 모드</label>
        <select
          value={displayMode(tenant.settings?.tenant_mode)}
          disabled={modeSaving}
          onChange={e => onModeChange(tenant, e.target.value as TenantMode)}
          className="w-full px-3 py-2 rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-surface-secondary)] text-[13px] font-semibold text-[var(--color-text-secondary)] outline-none disabled:opacity-40 focus:border-[var(--color-brand-primary)]"
        >
          <option value="회원공유">회원공유</option>
          <option value="회원개별">회원개별</option>
          <option value="비회원">비회원</option>
        </select>
      </div>

      {/* ── 액션 ── */}
      <div className="grid grid-cols-2 gap-2 mb-5">
        <button
          onClick={() => onOpenSchedule(tenant)}
          className="inline-flex items-center justify-center h-[36px] px-3 rounded-[9px] text-[12.5px] font-semibold border border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] shadow-[var(--shadow-xs)] hover:bg-[var(--color-surface-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
        >
          스케줄
        </button>
        <button
          onClick={() => onOpenAdmin(tenant)}
          className="inline-flex items-center justify-center h-[36px] px-3 rounded-[9px] text-[12.5px] font-semibold text-white transition-colors hover:opacity-90"
          style={{ background: 'var(--color-brand-primary)' }}
        >
          관리
        </button>
        {tenant.is_active === false ? (
          <button
            onClick={() => onReactivate(tenant)}
            className="col-span-2 inline-flex items-center justify-center h-[36px] px-3 rounded-[9px] text-[12.5px] font-semibold border border-green-200 text-green-600 hover:bg-green-50 dark:border-green-800 dark:text-green-400 transition-colors"
          >
            복구
          </button>
        ) : (
          <button
            disabled={deletingSaving}
            onClick={() => onDelete(tenant)}
            className="col-span-2 inline-flex items-center justify-center h-[36px] px-3 rounded-[9px] text-[12.5px] font-semibold bg-[var(--color-surface)] border transition-colors disabled:opacity-40 hover:bg-[var(--color-surface-secondary)]"
            style={{ borderColor: 'color-mix(in srgb, var(--color-brand-primary) 30%, var(--color-border))', color: 'oklch(0.45 0.14 28)' }}
          >
            삭제
          </button>
        )}
      </div>

      {/* ── 멤버 ── */}
      <div>
        <h3 className="text-[12px] font-bold text-[var(--color-text-muted)] uppercase tracking-wide mb-2">
          멤버 {!membersLoading && `(${approvedMembers.length})`}
        </h3>
        {membersLoading && <p className="text-xs text-[var(--color-text-muted)] py-3">불러오는 중...</p>}
        {!membersLoading && members.length === 0 && (
          <p className="text-xs text-[var(--color-text-muted)] py-3">멤버가 없습니다.</p>
        )}
        {!membersLoading && pendingMembers.length > 0 && (
          <div className="mb-2">
            <p className="text-[11px] font-bold text-[var(--color-text-muted)] mb-1">승인 대기 ({pendingMembers.length})</p>
            {pendingMembers.map(m => {
              const name = m.profile?.name ?? '-'
              const { bg: mbg, fg: mfg } = colorOf(name)
              return (
                <div key={m.id} className="hub-mem">
                  <span className="hub-avatar" style={{ background: mbg, color: mfg }}>{initialsOf(name)}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[12.5px] font-semibold text-[var(--color-text-primary)] truncate">{name}</span>
                    <span className="block text-[11px] text-[var(--color-text-muted)] truncate">{m.profile?.email ?? '-'} · {m.tenant_role?.name ?? m.role}</span>
                  </span>
                  <span className="flex gap-1 flex-shrink-0">
                    <button
                      disabled={approvingMemberId === m.id}
                      onClick={() => onApproveMember(m.id)}
                      className="px-2 py-1 text-[11px] font-medium rounded-lg bg-green-500 text-white hover:bg-green-600 disabled:opacity-40 transition-colors"
                    >
                      승인
                    </button>
                    <button
                      disabled={approvingMemberId === m.id}
                      onClick={() => onRejectMember(m.id)}
                      className="px-2 py-1 text-[11px] font-medium rounded-lg border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-40 transition-colors"
                    >
                      거절
                    </button>
                  </span>
                </div>
              )
            })}
          </div>
        )}
        {!membersLoading && approvedMembers.map(m => {
          const name = m.profile?.name ?? '-'
          const { bg: mbg, fg: mfg } = colorOf(name)
          return (
            <div key={m.id} className="hub-mem">
              <span className="hub-avatar" style={{ background: mbg, color: mfg }}>{initialsOf(name)}</span>
              <span className="flex-1 min-w-0">
                <span className="block text-[12.5px] font-semibold text-[var(--color-text-primary)] truncate">{name}</span>
                <span className="block text-[11px] text-[var(--color-text-muted)] truncate">{m.profile?.email ?? '-'}</span>
              </span>
              <span className="hub-mode-pill flex-shrink-0">{m.tenant_role?.name ?? m.role}</span>
            </div>
          )
        })}
      </div>
    </aside>
  )
}
