import { useMemo, useState } from 'react'
import type { Customer, PlanType, Tenant } from '../../types'
import { colorOf, initialsOf } from '../../lib/avatarColor'

const PLAN_GROUPS: { plan: PlanType; label: string }[] = [
  { plan: 'business', label: 'Business' },
  { plan: 'pro', label: 'Pro' },
  { plan: 'basic', label: 'Basic' },
]

const inputCls = 'w-full px-3 py-2 rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-primary)]/30 focus:border-[var(--color-brand-primary)]'

interface CustomerForm {
  name: string
  ownerEmail: string
  plan: PlanType
}

interface Props {
  customers: Customer[]
  tenants: Tenant[]
  selectedId: string
  onSelect: (id: string) => void
  pendingCustomerIds: Set<string>
  isOpen: boolean
  onClose: () => void
  showCreateCustomer: boolean
  setShowCreateCustomer: (v: boolean) => void
  customerForm: CustomerForm
  setCustomerForm: (updater: (prev: CustomerForm) => CustomerForm) => void
  customerSaving: boolean
  onCreateCustomer: (e: React.FormEvent) => void
}

export function AccountRail({
  customers, tenants, selectedId, onSelect, pendingCustomerIds, isOpen, onClose,
  showCreateCustomer, setShowCreateCustomer, customerForm, setCustomerForm, customerSaving, onCreateCustomer,
}: Props) {
  const [search, setSearch] = useState('')

  const orgCounts = useMemo(() => {
    const map: Record<string, number> = {}
    for (const t of tenants) map[t.customer_id] = (map[t.customer_id] ?? 0) + 1
    return map
  }, [tenants])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return customers
    return customers.filter(c => c.name.toLowerCase().includes(q))
  }, [customers, search])

  const groups = useMemo(() => {
    return PLAN_GROUPS.map(g => ({
      ...g,
      items: filtered.filter(c => c.plan === g.plan),
    })).filter(g => g.items.length > 0)
  }, [filtered])

  return (
    <>
      <div className={`hub-drawer-backdrop ${isOpen ? 'is-open' : ''}`} onClick={onClose} />
      <aside className={`hub-rail ${isOpen ? 'is-open' : ''}`}>
        <div className="p-3 border-b border-[var(--color-border)] space-y-2">
          <div className="flex items-center gap-2">
            <h2 className="m-0 text-[14px] font-extrabold tracking-[-0.3px] text-[var(--color-text-primary)]">고객 계정</h2>
            <span className="text-[11.5px] font-bold px-2 py-0.5 rounded-full" style={{ color: 'oklch(0.45 0.14 28)', background: 'oklch(0.95 0.045 28)' }}>
              {customers.length}
            </span>
            <button
              onClick={() => setShowCreateCustomer(!showCreateCustomer)}
              className="ml-auto inline-flex items-center justify-center w-7 h-7 rounded-lg border border-[var(--color-border-strong)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] transition-colors text-base font-bold leading-none"
              title="새 고객"
            >
              +
            </button>
          </div>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="고객명 검색"
            className={inputCls + ' text-xs py-1.5'}
          />
          {showCreateCustomer && (
            <form onSubmit={onCreateCustomer} className="p-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-secondary)] space-y-2">
              <input
                type="text" required value={customerForm.name}
                onChange={e => setCustomerForm(p => ({ ...p, name: e.target.value }))}
                placeholder="고객명 *" className={inputCls + ' text-xs py-1.5'}
              />
              <input
                type="email" value={customerForm.ownerEmail}
                onChange={e => setCustomerForm(p => ({ ...p, ownerEmail: e.target.value }))}
                placeholder="오너 이메일 (선택)" className={inputCls + ' text-xs py-1.5'}
              />
              <select
                value={customerForm.plan}
                onChange={e => setCustomerForm(p => ({ ...p, plan: e.target.value as PlanType }))}
                className={inputCls + ' text-xs py-1.5'}
              >
                <option value="basic">Basic (무료)</option>
                <option value="pro">Pro</option>
                <option value="business">Business</option>
              </select>
              <div className="flex gap-2">
                <button type="submit" disabled={customerSaving} className="flex-1 px-3 py-1.5 rounded-lg bg-[var(--color-brand-primary)] text-white text-xs font-semibold hover:opacity-90 disabled:opacity-40">
                  {customerSaving ? '저장 중...' : '생성'}
                </button>
                <button type="button" onClick={() => setShowCreateCustomer(false)} className="px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]">취소</button>
              </div>
            </form>
          )}
        </div>

        <div className="hub-rail-body">
          {groups.length === 0 && (
            <p className="text-center text-xs text-[var(--color-text-muted)] py-8">검색 결과가 없습니다.</p>
          )}
          {groups.map(g => (
            <div key={g.plan}>
              <div className="hub-rail-group-label">{g.label} · {g.items.length}</div>
              {g.items.map(c => {
                const { bg, fg } = colorOf(c.name)
                const isSystem = c.id === '00000000-0000-0000-0000-000000000001'
                return (
                  <button
                    key={c.id}
                    onClick={() => { onSelect(c.id); onClose() }}
                    className={`hub-acct ${selectedId === c.id ? 'is-selected' : ''}`}
                  >
                    <span className="hub-avatar" style={{ background: bg, color: fg }}>{initialsOf(c.name)}</span>
                    <span className="flex-1 min-w-0">
                      <span className={`block text-[13px] font-bold truncate ${c.is_active === false ? 'text-[var(--color-text-muted)]' : 'text-[var(--color-text-primary)]'}`}>
                        {c.name}{isSystem && <span className="ml-1 text-[10px] font-bold text-[var(--color-text-muted)]">시스템</span>}
                      </span>
                      <span className="block text-[11px] text-[var(--color-text-muted)]">조직 {orgCounts[c.id] ?? 0}개</span>
                    </span>
                    <span className="flex flex-col items-end gap-1 flex-shrink-0">
                      {c.deletion_requested_at && <span className="hub-badge hub-badge-danger">탈퇴요청</span>}
                      {pendingCustomerIds.has(c.id) && <span className="hub-dot-pending" title="승인 대기 있음" />}
                    </span>
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      </aside>
    </>
  )
}
