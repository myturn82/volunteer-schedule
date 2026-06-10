import type { Customer, PlanType, Tenant } from '../../types'
import { colorOf, initialsOf } from '../../lib/avatarColor'
import { SlotEditor } from '../shared/SlotEditor'
import { IndustryPicker } from '../IndustryPicker'
import { OrgTreeView } from './OrgTreeView'
import { OrgDiagramView } from './OrgDiagramView'
import { OrgCardsView } from './OrgCardsView'
import { EMPTY_ORG_FORM, type CreateOrgForm } from './createOrgForm'

const inputCls = 'w-full px-3 py-2 rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-primary)]/30 focus:border-[var(--color-brand-primary)]'

const SYSTEM_CUSTOMER_ID = '00000000-0000-0000-0000-000000000001'

export type HubView = 'tree' | 'diagram' | 'cards'

interface Props {
  customer: Customer
  tenants: Tenant[]
  memberCounts: Record<string, number>
  pendingCounts: Record<string, number>
  view: HubView
  setView: (v: HubView) => void
  selectedOrgId: string | null
  onSelectOrg: (id: string) => void
  onOpenRail: () => void

  ownerEmails: Record<string, string>
  editingOwnerCustomerId: string | null
  setEditingOwnerCustomerId: (id: string | null) => void
  editOwnerEmail: string
  setEditOwnerEmail: (v: string) => void
  ownerSaving: boolean
  saveOwner: (customerId: string) => void

  updateCustomerPlan: (customerId: string, plan: PlanType) => void
  toggleCustomerActive: (customer: Customer) => void
  startDeleteCustomer: (customer: Customer) => void
  restoreCustomer: (customer: Customer) => void
  restoringId: string | null
  onHardDelete: (customer: Customer) => void

  showCreate: boolean
  setShowCreate: (v: boolean) => void
  form: CreateOrgForm
  setForm: (updater: (prev: CreateOrgForm) => CreateOrgForm) => void
  createSlots: string[]
  setCreateSlots: (slots: string[]) => void
  saving: boolean
  onCreateTenant: (e: React.FormEvent) => void
}

export function HubMain({
  customer, tenants, memberCounts, pendingCounts, view, setView, selectedOrgId, onSelectOrg, onOpenRail,
  ownerEmails, editingOwnerCustomerId, setEditingOwnerCustomerId, editOwnerEmail, setEditOwnerEmail, ownerSaving, saveOwner,
  updateCustomerPlan, toggleCustomerActive, startDeleteCustomer, restoreCustomer, restoringId, onHardDelete,
  showCreate, setShowCreate, form, setForm, createSlots, setCreateSlots, saving, onCreateTenant,
}: Props) {
  const isSystem = customer.id === SYSTEM_CUSTOMER_ID
  const { bg, fg } = colorOf(customer.name)

  const totalMembers = tenants.reduce((sum, t) => sum + (memberCounts[t.id] ?? 0), 0)
  const totalSlots = tenants.reduce((sum, t) => sum + (t.settings?.time_slots?.length ?? 0), 0)
  const totalPending = tenants.reduce((sum, t) => sum + (pendingCounts[t.id] ?? 0), 0)

  const elapsed = customer.deletion_requested_at
    ? Math.floor((Date.now() - new Date(customer.deletion_requested_at).getTime()) / 86_400_000)
    : 0
  const canHardDelete = elapsed >= 30

  return (
    <div className="hub-main">
      <div className="hub-breadcrumb">
        <button
          onClick={onOpenRail}
          className="hidden max-[1000px]:inline-flex items-center justify-center w-7 h-7 rounded-lg border border-[var(--color-border-strong)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] mr-1"
          title="고객 목록"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
        </button>
        <span>계정 허브</span>
        <span>›</span>
        <b>{customer.name}</b>
      </div>

      {/* ── Hero ── */}
      <div className="hub-hero">
        <div className="flex items-start gap-4 flex-wrap">
          <span className="hub-avatar is-lg" style={{ background: bg, color: fg }}>{initialsOf(customer.name)}</span>
          <div className="flex-1 min-w-0">
            <h1 className="m-0 text-[19px] font-extrabold tracking-[-0.4px] text-[var(--color-text-primary)] flex items-center gap-2 flex-wrap">
              {customer.name}
              {isSystem && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--color-surface-secondary)] text-[var(--color-text-muted)]">시스템</span>}
              {customer.is_active === false && <span className="hub-badge hub-badge-danger">비활성</span>}
            </h1>
            <div className="flex items-center gap-2 flex-wrap mt-2 text-xs">
              <select
                value={customer.plan}
                onChange={e => updateCustomerPlan(customer.id, e.target.value as PlanType)}
                className="px-2 py-1 rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-surface)] text-xs font-semibold text-[var(--color-text-secondary)] focus:outline-none"
              >
                <option value="basic">Basic</option>
                <option value="pro">Pro</option>
                <option value="business">Business</option>
              </select>

              {editingOwnerCustomerId === customer.id ? (
                <span className="flex items-center gap-1">
                  <input
                    value={editOwnerEmail}
                    onChange={e => setEditOwnerEmail(e.target.value)}
                    placeholder="오너 이메일"
                    className="text-xs px-2 py-1 rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-text-primary)] w-40 focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-primary)]/30 focus:border-[var(--color-brand-primary)]"
                    onKeyDown={e => { if (e.key === 'Enter') saveOwner(customer.id); if (e.key === 'Escape') setEditingOwnerCustomerId(null) }}
                    autoFocus
                  />
                  <button onClick={() => saveOwner(customer.id)} disabled={ownerSaving}
                    className="px-1.5 py-1 text-xs bg-[var(--color-brand-primary)] text-white rounded-lg disabled:opacity-40">
                    {ownerSaving ? '...' : '저장'}
                  </button>
                  <button onClick={() => setEditingOwnerCustomerId(null)}
                    className="px-1.5 py-1 text-xs border border-[var(--color-border-strong)] text-[var(--color-text-secondary)] rounded-lg">취소</button>
                </span>
              ) : (
                <button
                  onClick={() => {
                    setEditingOwnerCustomerId(customer.id)
                    setEditOwnerEmail(customer.owner_user_id ? (ownerEmails[customer.owner_user_id] ?? '') : '')
                  }}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-brand-primary)] hover:border-[var(--color-brand-primary)]/40 transition-colors"
                >
                  오너: {customer.owner_user_id ? (ownerEmails[customer.owner_user_id] ?? '...') : '미설정'}
                </button>
              )}

              <span className="text-[var(--color-text-muted)]">가입일 {customer.created_at.slice(0, 10)}</span>
            </div>
          </div>

          {!isSystem && (
            <div className="flex gap-2 flex-shrink-0">
              <button
                onClick={() => toggleCustomerActive(customer)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${customer.is_active
                  ? 'border border-amber-200 text-amber-700 hover:bg-amber-50'
                  : 'border border-green-200 text-green-700 hover:bg-green-50'}`}
              >
                {customer.is_active ? '비활성화' : '복구'}
              </button>
              <button
                onClick={() => startDeleteCustomer(customer)}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
              >
                삭제
              </button>
            </div>
          )}
        </div>

        {customer.deletion_requested_at && (
          <div className="mt-4 flex items-center gap-3 bg-red-50 border border-red-200 rounded-2xl px-4 py-3 flex-wrap">
            <div className="flex-1 min-w-0">
              <span className="font-semibold text-sm text-[var(--color-text-primary)]">탈퇴 요청 중</span>
              <span className="ml-2 text-xs text-red-500">{elapsed}일 경과</span>
              {canHardDelete && <span className="ml-2 text-[11px] font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded">삭제 가능</span>}
            </div>
            <button
              onClick={() => restoreCustomer(customer)}
              disabled={restoringId === customer.id}
              className="px-3 py-1.5 rounded-lg border border-[var(--color-border)] bg-white text-xs font-semibold text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] transition-colors disabled:opacity-50"
            >
              복구
            </button>
            <button
              onClick={() => onHardDelete(customer)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${canHardDelete
                ? 'bg-red-600 text-white hover:bg-red-700'
                : 'border border-red-300 text-red-500 hover:bg-red-100'}`}
            >
              완전 삭제{!canHardDelete && ' ⚠'}
            </button>
          </div>
        )}

        <div className="hub-stats">
          <div className="hub-stat">
            <div className="hub-stat-value">{tenants.length}</div>
            <div className="hub-stat-label">조직</div>
          </div>
          <div className="hub-stat">
            <div className="hub-stat-value">{totalMembers}</div>
            <div className="hub-stat-label">활성 멤버</div>
          </div>
          <div className="hub-stat">
            <div className="hub-stat-value">{totalSlots}</div>
            <div className="hub-stat-label">슬롯 합계</div>
          </div>
          <div className="hub-stat">
            <div className="hub-stat-value">{totalPending}</div>
            <div className="hub-stat-label">승인 대기</div>
          </div>
        </div>
      </div>

      {/* ── View switcher + create ── */}
      <div className="flex items-center gap-3 flex-wrap mb-3">
        <div className="hub-view-switch">
          <button onClick={() => setView('tree')} className={`hub-view-btn ${view === 'tree' ? 'is-active' : ''}`}>트리</button>
          <button onClick={() => setView('diagram')} className={`hub-view-btn ${view === 'diagram' ? 'is-active' : ''}`}>다이어그램</button>
          <button onClick={() => setView('cards')} className={`hub-view-btn ${view === 'cards' ? 'is-active' : ''}`}>카드</button>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="ml-auto inline-flex items-center justify-center gap-[6px] h-[36px] px-[16px] rounded-[11px] text-[13px] font-bold whitespace-nowrap text-white transition-colors hover:opacity-90"
          style={{ background: 'var(--color-brand-primary)' }}
        >
          + 새 조직
        </button>
      </div>

      {/* ── Create org form ── */}
      {showCreate && (
        <form onSubmit={onCreateTenant} className="mb-6 p-5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] space-y-4">
          <h3 className="font-semibold text-[var(--color-text-primary)]">새 조직 만들기 — {customer.name}</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {([
              { key: 'slug', label: 'Slug (소문자+하이픈)', placeholder: 'my-org', required: true, maxLength: 50 },
              { key: 'name', label: '조직명', placeholder: '한서미용실', required: true, maxLength: 50 },
              { key: 'title', label: '페이지 타이틀 (선택)', placeholder: '스케줄', maxLength: 50 },
              { key: 'theme_color', label: '테마 색상 (선택)', placeholder: '#2563eb', maxLength: 7 },
            ] as { key: keyof CreateOrgForm; label: string; placeholder: string; required?: boolean; maxLength?: number }[]).map(f => (
              <div key={f.key}>
                <label className="block text-xs text-[var(--color-text-secondary)] mb-1">{f.label}</label>
                <input
                  type="text"
                  placeholder={f.placeholder}
                  required={f.required}
                  maxLength={f.maxLength}
                  value={form[f.key]}
                  onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                  className={inputCls}
                />
              </div>
            ))}
            <div className="sm:col-span-2">
              <IndustryPicker
                value={form.business_type}
                onChange={v => setForm(prev => ({ ...prev, business_type: v }))}
                inputCls={inputCls}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-[var(--color-text-secondary)] mb-2">운영 모드</label>
            <div className="flex gap-3">
              {(['회원공유', '회원개별', '비회원'] as const).map(mode => (
                <label key={mode} className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="tenant_mode"
                    value={mode}
                    checked={form.tenant_mode === mode}
                    onChange={() => setForm(prev => ({ ...prev, tenant_mode: mode }))}
                    className="accent-[var(--color-brand-primary)]"
                  />
                  <span className="text-sm text-[var(--color-text-secondary)]">{mode}</span>
                </label>
              ))}
            </div>
          </div>

          <SlotEditor slots={createSlots} onChange={setCreateSlots} />

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={saving || !form.slug || !form.name}
              className="px-4 py-2 rounded-xl bg-[var(--color-brand-primary)] text-white text-sm font-medium hover:bg-[var(--color-brand-primary-hover)] disabled:opacity-40"
            >
              {saving ? '저장 중...' : '생성'}
            </button>
            <button
              type="button"
              onClick={() => { setShowCreate(false); setForm(() => EMPTY_ORG_FORM) }}
              className="px-4 py-2 rounded-xl border border-[var(--color-border)] text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]"
            >
              취소
            </button>
          </div>
        </form>
      )}

      {/* ── Org views ── */}
      {view === 'tree' && (
        <OrgTreeView tenants={tenants} memberCounts={memberCounts} pendingCounts={pendingCounts} selectedOrgId={selectedOrgId} onSelect={onSelectOrg} />
      )}
      {view === 'diagram' && (
        <OrgDiagramView customerName={customer.name} tenants={tenants} memberCounts={memberCounts} pendingCounts={pendingCounts} selectedOrgId={selectedOrgId} onSelect={onSelectOrg} />
      )}
      {view === 'cards' && (
        <OrgCardsView tenants={tenants} memberCounts={memberCounts} pendingCounts={pendingCounts} selectedOrgId={selectedOrgId} onSelect={onSelectOrg} />
      )}
    </div>
  )
}
