import type { Tenant } from '../../types'
import { colorOf, initialsOf } from '../../lib/avatarColor'
import { displayMode } from '../../lib/tenantMode'

interface Props {
  tenants: Tenant[]
  memberCounts: Record<string, number>
  pendingCounts: Record<string, number>
  selectedOrgId: string | null
  onSelect: (id: string) => void
}

export function OrgTreeView({ tenants, memberCounts, pendingCounts, selectedOrgId, onSelect }: Props) {
  if (tenants.length === 0) {
    return <p className="text-center text-sm text-[var(--color-text-muted)] py-12">조직이 없습니다.</p>
  }

  return (
    <div className="hub-tree">
      {tenants.map(t => {
        const { bg, fg } = colorOf(t.name)
        const pending = pendingCounts[t.id] ?? 0
        return (
          <div
            key={t.id}
            onClick={() => onSelect(t.id)}
            className={`hub-node ${selectedOrgId === t.id ? 'is-selected' : ''} ${t.is_active === false ? 'is-inactive' : ''}`}
          >
            <span className="hub-avatar" style={{ background: bg, color: fg }}>{initialsOf(t.name)}</span>
            <span className="flex-1 min-w-0">
              <span className="flex items-baseline gap-2 flex-wrap">
                <span className="text-[14px] font-bold text-[var(--color-text-primary)] truncate">{t.name}</span>
                <span className="text-[11.5px] font-mono text-[var(--color-text-muted)]">{t.slug}</span>
                {t.is_active === false && <span className="hub-badge hub-badge-danger">비활성</span>}
                {pending > 0 && <span className="hub-badge hub-badge-pending">승인대기 {pending}</span>}
              </span>
              {t.business_type && (
                <span className="block text-[11.5px] text-[var(--color-text-muted)] mt-0.5">{t.business_type}</span>
              )}
            </span>
            <span className="flex flex-col items-end gap-1 flex-shrink-0">
              <span className="hub-mode-pill">{displayMode(t.settings?.tenant_mode)}</span>
              <span className="text-[11px] text-[var(--color-text-muted)]">멤버 {memberCounts[t.id] ?? 0}명</span>
            </span>
          </div>
        )
      })}
    </div>
  )
}
