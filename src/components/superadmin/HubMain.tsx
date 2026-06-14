import { useState, useEffect } from 'react'
import type { Customer, PlanType, Tenant } from '../../types'
import { colorOf, initialsOf } from '../../lib/avatarColor'
import { SlotEditor } from '../shared/SlotEditor'
import { IndustryPicker } from '../IndustryPicker'
import { OrgTreeView } from './OrgTreeView'
import { OrgDiagramView } from './OrgDiagramView'
import { OrgCardsView } from './OrgCardsView'
import { EMPTY_ORG_FORM, type CreateOrgForm } from './createOrgForm'
import { formatPhone } from '../../lib/phone'
import { THEME_COLORS } from '../../lib/themeColors'

const inputCls = 'w-full px-3 py-2 rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-primary)]/30 focus:border-[var(--color-brand-primary)]'

const SYSTEM_CUSTOMER_ID = '00000000-0000-0000-0000-000000000001'

const Ic = {
  org:     (s = 15) => <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="8" y="3" width="8" height="5" rx="1.2"/><rect x="3" y="16" width="6" height="5" rx="1.2"/><rect x="15" y="16" width="6" height="5" rx="1.2"/><path d="M12 8v4M6 16v-2h12v2"/></svg>,
  members: (s = 15) => <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="3.2"/><path d="M5.5 20c0-3.2 2.9-5.2 6.5-5.2s6.5 2 6.5 5.2"/></svg>,
  slot:    (s = 14) => <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="17" rx="2.5"/><path d="M3 9h18M8 2.5v4M16 2.5v4"/></svg>,
  pending: (s = 14) => <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>,
  tree:    (s = 15) => <svg viewBox="0 0 20 20" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="7.5" y="2.5" width="5" height="4" rx="1"/><rect x="2.5" y="13" width="5" height="4" rx="1"/><rect x="12.5" y="13" width="5" height="4" rx="1"/><path d="M10 6.5V10M5 13v-3h10v3"/></svg>,
  diagram: (s = 15) => <svg viewBox="0 0 20 20" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="4" cy="10" r="2.3"/><circle cx="15" cy="5" r="2.1"/><circle cx="15" cy="15" r="2.1"/><path d="M6.2 9 13 5.7M6.2 11 13 14.3"/></svg>,
  cards:   (s = 15) => <svg viewBox="0 0 20 20" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="2.5" y="3" width="15" height="6" rx="1.5"/><rect x="2.5" y="11.5" width="15" height="6" rx="1.5"/></svg>,
}

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
  phoneSaving: boolean
  ownerSaving: boolean
  savePhone: (customerId: string, phone: string) => Promise<void>
  saveOwner: (customerId: string, email: string) => Promise<void>

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
  ownerEmails, phoneSaving, ownerSaving, savePhone, saveOwner,
  updateCustomerPlan, toggleCustomerActive, startDeleteCustomer, restoreCustomer, restoringId, onHardDelete,
  showCreate, setShowCreate, form, setForm, createSlots, setCreateSlots, saving, onCreateTenant,
}: Props) {
  const [colorOpen, setColorOpen] = useState(false)

  const currentOwnerEmail = customer.owner_user_id ? (ownerEmails[customer.owner_user_id] ?? '') : ''
  const [localPlan, setLocalPlan] = useState<PlanType>(customer.plan)
  const [localPhone, setLocalPhone] = useState(formatPhone(customer.phone ?? ''))
  const [localOwnerEmail, setLocalOwnerEmail] = useState(currentOwnerEmail)
  const [fieldSaving, setFieldSaving] = useState(false)

  useEffect(() => {
    setLocalPlan(customer.plan)
    setLocalPhone(formatPhone(customer.phone ?? ''))
    setLocalOwnerEmail(customer.owner_user_id ? (ownerEmails[customer.owner_user_id] ?? '') : '')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer.id])

  useEffect(() => {
    const email = customer.owner_user_id ? (ownerEmails[customer.owner_user_id] ?? '') : ''
    if (email) setLocalOwnerEmail(prev => prev || email)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerEmails, customer.owner_user_id])

  const isPlanDirty = localPlan !== customer.plan
  const isPhoneDirty = localPhone !== formatPhone(customer.phone ?? '')
  const isOwnerDirty = localOwnerEmail !== currentOwnerEmail
  const isDirty = isPlanDirty || isPhoneDirty || isOwnerDirty

  async function handleSaveAll() {
    setFieldSaving(true)
    if (isPlanDirty) updateCustomerPlan(customer.id, localPlan)
    if (isPhoneDirty) await savePhone(customer.id, localPhone)
    if (isOwnerDirty) await saveOwner(customer.id, localOwnerEmail)
    setFieldSaving(false)
  }

  function handleCancel() {
    setLocalPlan(customer.plan)
    setLocalPhone(formatPhone(customer.phone ?? ''))
    setLocalOwnerEmail(currentOwnerEmail)
  }

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
            <div className="hub-hero-meta">
              <span>가입 <span style={{ fontFamily: 'var(--font-mono, monospace)' }}>{customer.created_at.slice(0, 10)}</span></span>
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

        {/* ── Account info fieldset ── */}
        <div className="hub-fieldset">
          <div className="hub-fieldset-head">계정 정보</div>
          <div className="hub-field-grid">

            {/* 요금제 */}
            <div className={`hub-field${isPlanDirty ? ' dirty' : ''}`}>
              <label className="hub-field-lab" htmlFor="hub-plan">요금제</label>
              <div className="hub-field-control">
                <select
                  id="hub-plan"
                  value={localPlan}
                  onChange={e => setLocalPlan(e.target.value as PlanType)}
                >
                  <option value="basic">Basic</option>
                  <option value="pro">Pro</option>
                  <option value="business">Business</option>
                </select>
              </div>
            </div>

            {/* 가입일 — 조회 전용 (데스크톱만, 모바일은 hero-meta로 표시) */}
            <div className="hub-field hub-field-date">
              <div className="hub-field-lab">
                가입일
                <span className="ro-tag">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" width="10" height="10"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>
                  조회 전용
                </span>
              </div>
              <div className="hub-field-ro">
                <span className="ci">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4.5" width="18" height="16.5" rx="2.5"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/></svg>
                </span>
                <span style={{ fontFamily: 'var(--font-mono, monospace)', letterSpacing: '0.01em' }}>{customer.created_at.slice(0, 10)}</span>
              </div>
            </div>

            {/* 전화번호 */}
            <div className={`hub-field${isPhoneDirty ? ' dirty' : ''}`}>
              <label className="hub-field-lab" htmlFor="hub-phone">전화번호</label>
              <div className="hub-field-control">
                <input
                  id="hub-phone"
                  type="tel"
                  inputMode="tel"
                  value={localPhone}
                  onChange={e => setLocalPhone(formatPhone(e.target.value))}
                  placeholder="010-1234-5678"
                  maxLength={13}
                />
                <span className="edit-ic">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                </span>
              </div>
            </div>

            {/* 오너 */}
            <div className={`hub-field${isOwnerDirty ? ' dirty' : ''}`}>
              <label className="hub-field-lab" htmlFor="hub-owner">오너</label>
              <div className="hub-field-control">
                <input
                  id="hub-owner"
                  type="email"
                  inputMode="email"
                  value={localOwnerEmail}
                  onChange={e => setLocalOwnerEmail(e.target.value)}
                  placeholder="owner@example.com"
                />
                <span className="edit-ic">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                </span>
              </div>
            </div>

          </div>

          {isDirty && (
            <div className="hub-save-bar">
              <span className="msg">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 9v4M12 17h.01"/><circle cx="12" cy="12" r="9"/></svg>
                변경한 항목이 있어요.
              </span>
              <div className="acts">
                <button
                  onClick={handleCancel}
                  disabled={fieldSaving || phoneSaving || ownerSaving}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-[var(--color-border-strong)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] disabled:opacity-40 transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={handleSaveAll}
                  disabled={fieldSaving || phoneSaving || ownerSaving}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-[var(--color-brand-primary)] text-white hover:opacity-90 disabled:opacity-40 transition-colors"
                >
                  {fieldSaving || phoneSaving || ownerSaving ? '저장 중...' : '변경사항 저장'}
                </button>
              </div>
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
            <div className="hub-stat-label">{Ic.org(13)} 조직</div>
          </div>
          <div className="hub-stat">
            <div className="hub-stat-value">{totalMembers}</div>
            <div className="hub-stat-label">{Ic.members(13)} 전체 멤버</div>
          </div>
          <div className="hub-stat">
            <div className="hub-stat-value">{totalSlots}</div>
            <div className="hub-stat-label">{Ic.slot(13)} 슬롯 합계</div>
          </div>
          <div className="hub-stat">
            <div className="hub-stat-value">{totalPending}</div>
            <div className="hub-stat-label">{Ic.pending(13)} 승인 대기</div>
          </div>
        </div>
      </div>

      {/* ── View switcher + create ── */}
      <div className="flex items-center gap-3 flex-wrap mb-3">
        <div className="hub-view-switch">
          <button onClick={() => setView('tree')} className={`hub-view-btn ${view === 'tree' ? 'is-active' : ''}`}>{Ic.tree(15)} 트리</button>
          <button onClick={() => setView('diagram')} className={`hub-view-btn ${view === 'diagram' ? 'is-active' : ''}`}>{Ic.diagram(15)} 다이어그램</button>
          <button onClick={() => setView('cards')} className={`hub-view-btn ${view === 'cards' ? 'is-active' : ''}`}>{Ic.cards(15)} 카드</button>
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
              { key: 'name', label: '조직명', placeholder: '조직명', required: true, maxLength: 50 },
              { key: 'title', label: '페이지 타이틀 (선택)', placeholder: '스케줄', maxLength: 50 },
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

          {/* 테마 색상 스워치 피커 */}
          <div>
            <button
              type="button"
              onClick={() => setColorOpen(!colorOpen)}
              className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: colorOpen ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}>
                <path d="M4 2l4 4-4 4" />
              </svg>
              <span>테마 색상 (선택)</span>
              {form.theme_color && <span className="w-4 h-4 rounded-sm border border-[var(--color-border-strong)] inline-block" style={{ background: form.theme_color }} />}
            </button>
            {colorOpen && (
              <div className="mt-2 space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  {THEME_COLORS.map(color => (
                    <button
                      key={color}
                      type="button"
                      title={color}
                      onClick={() => setForm(prev => ({ ...prev, theme_color: prev.theme_color === color ? '' : color }))}
                      className="w-7 h-7 rounded-lg border-2 transition-transform hover:scale-110 flex items-center justify-center flex-shrink-0"
                      style={{ background: color, borderColor: form.theme_color === color ? '#1f2937' : 'transparent', boxShadow: form.theme_color === color ? '0 0 0 1px #fff inset' : undefined }}
                    >
                      {form.theme_color === color && (
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  {form.theme_color && <span className="w-6 h-6 rounded-md border border-[var(--color-border-strong)] flex-shrink-0" style={{ background: form.theme_color }} />}
                  <input
                    type="text"
                    placeholder="직접 입력 (#2563eb)"
                    maxLength={7}
                    value={form.theme_color}
                    onChange={e => setForm(prev => ({ ...prev, theme_color: e.target.value }))}
                    className={inputCls + ' text-xs py-1.5 font-mono'}
                  />
                  {form.theme_color && (
                    <button type="button" onClick={() => setForm(prev => ({ ...prev, theme_color: '' }))} className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] flex-shrink-0">
                      초기화
                    </button>
                  )}
                </div>
              </div>
            )}
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
