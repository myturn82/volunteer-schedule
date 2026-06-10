import type { Tenant } from '../../types'
import { colorOf, initialsOf } from '../../lib/avatarColor'
import { displayMode } from '../../lib/tenantMode'

interface Props {
  customerName: string
  tenants: Tenant[]
  memberCounts: Record<string, number>
  pendingCounts: Record<string, number>
  selectedOrgId: string | null
  onSelect: (id: string) => void
}

export function OrgDiagramView({ customerName, tenants, memberCounts, pendingCounts, selectedOrgId, onSelect }: Props) {
  if (tenants.length === 0) {
    return <p className="text-center text-sm text-[var(--color-text-muted)] py-12">조직이 없습니다.</p>
  }

  const root = colorOf(customerName)

  return (
    <div className="hub-diagram">
      <div className="hub-dg-root">
        <span className="hub-avatar is-lg" style={{ background: root.bg, color: root.fg }}>{initialsOf(customerName)}</span>
        <span className="text-[14px] font-extrabold text-[var(--color-text-primary)] whitespace-nowrap">{customerName}</span>
      </div>
      <div className="hub-dg-branches">
        {tenants.map(t => {
          const { bg, fg } = colorOf(t.name)
          const pending = pendingCounts[t.id] ?? 0
          return (
            <div
              key={t.id}
              onClick={() => onSelect(t.id)}
              className={`hub-dg-node ${selectedOrgId === t.id ? 'is-selected' : ''} ${t.is_active === false ? 'is-inactive' : ''}`}
            >
              <span className="hub-avatar" style={{ background: bg, color: fg }}>{initialsOf(t.name)}</span>
              <span className="flex flex-col min-w-0">
                <span className="flex items-center gap-2">
                  <span className="text-[13px] font-bold text-[var(--color-text-primary)] whitespace-nowrap">{t.name}</span>
                  {pending > 0 && <span className="hub-badge hub-badge-pending">{pending}</span>}
                </span>
                <span className="text-[11px] text-[var(--color-text-muted)] whitespace-nowrap">
                  {displayMode(t.settings?.tenant_mode)} · 멤버 {memberCounts[t.id] ?? 0}명
                </span>
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
