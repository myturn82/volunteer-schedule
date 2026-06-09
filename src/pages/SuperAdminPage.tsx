import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useTenant } from '../contexts/TenantContext'
import { SlotEditor } from '../components/shared/SlotEditor'
import { IndustryPicker } from '../components/IndustryPicker'
import type { Tenant, TenantMode, Customer, PlanType } from '../types'

// ─── Create form ──────────────────────────────────────────────────────────────

interface CreateForm {
  slug: string
  name: string
  business_type: string
  title: string
  theme_color: string
  tenant_mode: TenantMode
}

const EMPTY_FORM: CreateForm = { slug: '', name: '', business_type: '', title: '', theme_color: '', tenant_mode: '회원공유' }
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

function displayMode(raw: string | undefined): TenantMode {
  if (raw === '회원선택') return '회원공유'
  if (raw === '직접입력') return '비회원'
  return (raw as TenantMode) ?? '회원공유'
}

// ─── SuperAdminPage ───────────────────────────────────────────────────────────

export function SuperAdminPage() {
  const { profile, loading: authLoading } = useAuth()
  const { setTenant } = useTenant()
  const navigate = useNavigate()

  const [tenants, setTenants]       = useState<Tenant[]>([])
  const [loading, setLoading]       = useState(true)
  const [message, setMessage]       = useState('')

  // Create form state
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm]             = useState<CreateForm>(EMPTY_FORM)
  const [createSlots, setCreateSlots] = useState<string[]>(['09-12', '13-14', '14-16', '16-18', '20-22'])
  const [saving, setSaving]         = useState(false)

  // Edit state
  const [modeSaving, setModeSaving] = useState(false)

  // Name edit state
  const [editingNameId, setEditingNameId] = useState<string | null>(null)
  const [editName, setEditName]           = useState('')
  const [nameSaving, setNameSaving]       = useState(false)
  const [deletingSaving, setDeletingSaving] = useState(false)

  // Slug edit state
  const [editingSlugId, setEditingSlugId] = useState<string | null>(null)
  const [editSlug, setEditSlug]           = useState('')
  const [slugSaving, setSlugSaving]       = useState(false)

  // Delete confirmation modal
  const [deleteConfirm, setDeleteConfirm] = useState<{ tenant: Tenant; assignCount: number; memberCount: number } | null>(null)
  const [deleteNameInput, setDeleteNameInput] = useState('')

  // Mode change warning modal
  const [pendingModeChange, setPendingModeChange] = useState<{ tenant: Tenant; from: TenantMode; to: TenantMode; unassignedCount?: number } | null>(null)

  // Pending admin approvals
  const [pendingAdmins, setPendingAdmins] = useState<import('../types').Profile[]>([])

  // Pending member approvals (all non-admin users)
  interface PendingMember {
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
  const [pendingMembers, setPendingMembers] = useState<PendingMember[]>([])
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set())
  const [approving, setApproving] = useState(false)

  // Customer management state
  const [customers, setCustomers] = useState<Customer[]>([])
  const [showCreateCustomer, setShowCreateCustomer] = useState(false)
  const [customerForm, setCustomerForm] = useState({ name: '', ownerEmail: '', plan: 'basic' as PlanType })
  const [customerSaving, setCustomerSaving] = useState(false)
  const [createOrgCustomerId, setCreateOrgCustomerId] = useState<string>('')
  const [deletionRequests, setDeletionRequests]   = useState<Customer[]>([])
  const [restoringId, setRestoringId]             = useState<string | null>(null)
  const [hardDeleteConfirm, setHardDeleteConfirm] = useState<Customer | null>(null)
  const [hardDeleteSaving, setHardDeleteSaving]   = useState(false)

  // Org list filter
  const [filterCustomerId, setFilterCustomerId] = useState('')

  // Customer delete state
  const [deleteCustomerConfirm, setDeleteCustomerConfirm] = useState<{ customer: Customer; tenantCount: number } | null>(null)
  const [deleteCustomerSaving, setDeleteCustomerSaving] = useState(false)
  const [deleteCustomerNameInput, setDeleteCustomerNameInput] = useState('')

  // Owner edit state
  const [editingOwnerCustomerId, setEditingOwnerCustomerId] = useState<string | null>(null)
  const [editOwnerEmail, setEditOwnerEmail] = useState('')
  const [ownerSaving, setOwnerSaving] = useState(false)
  const [ownerEmails, setOwnerEmails] = useState<Record<string, string>>({})

  async function loadOwnerEmails(customerList: Customer[]) {
    const ownerIds = customerList.map(c => c.owner_user_id).filter(Boolean) as string[]
    if (ownerIds.length === 0) return
    const { data } = await supabase.from('profiles').select('id, email').in('id', ownerIds)
    const map: Record<string, string> = {}
    for (const p of data ?? []) map[p.id] = p.email ?? '(이메일 없음)'
    setOwnerEmails(map)
  }

  async function saveOwner(customerId: string) {
    setOwnerSaving(true)
    const email = editOwnerEmail.trim()
    let ownerUserId: string | null = null
    if (email) {
      const { data: prof } = await supabase.from('profiles').select('id, email').eq('email', email).maybeSingle()
      if (!prof) { setMessage('오너 설정 오류: 해당 이메일의 가입 유저를 찾을 수 없습니다.'); setOwnerSaving(false); return }
      ownerUserId = prof.id
    }
    const { data, error } = await supabase
      .from('customers')
      .update({ owner_user_id: ownerUserId, updated_at: new Date().toISOString() })
      .eq('id', customerId)
      .select()
      .single()
    if (error) { setMessage(`오류: ${error.message}`); setOwnerSaving(false); return }
    if (data) {
      setCustomers(prev => prev.map(c => c.id === customerId ? data as Customer : c))
      if (ownerUserId) setOwnerEmails(prev => ({ ...prev, [ownerUserId!]: email }))
      setMessage(ownerUserId ? '오너가 설정됐습니다.' : '오너가 해제됐습니다.')
    }
    setEditingOwnerCustomerId(null)
    setOwnerSaving(false)
  }

  async function fetchCustomers() {
    const [custRes, delRes] = await Promise.all([
      supabase.from('customers').select('*').order('created_at'),
      supabase.from('customers').select('*').not('deletion_requested_at', 'is', null).order('deletion_requested_at', { ascending: true }),
    ])
    const list = (custRes.data ?? []) as Customer[]
    setCustomers(list)
    setDeletionRequests((delRes.data ?? []) as Customer[])
    loadOwnerEmails(list)
  }

  async function restoreCustomer(customer: Customer) {
    setRestoringId(customer.id)
    const { error } = await supabase
      .from('customers')
      .update({ is_active: true, deletion_requested_at: null })
      .eq('id', customer.id)
    if (error) {
      setMessage(`복구 오류: ${error.message}`)
    } else {
      setDeletionRequests(prev => prev.filter(c => c.id !== customer.id))
      setCustomers(prev => prev.map(c =>
        c.id === customer.id ? { ...c, is_active: true, deletion_requested_at: null } : c
      ))
      setMessage(`'${customer.name}' 계정이 복구됐습니다.`)
    }
    setRestoringId(null)
  }

  async function executeHardDelete() {
    if (!hardDeleteConfirm) return
    setHardDeleteSaving(true)
    try {
      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', hardDeleteConfirm.id)
      if (error) {
        setMessage(`삭제 오류: ${error.message}`)
      } else {
        const deletedId = hardDeleteConfirm.id
        setDeletionRequests(prev => prev.filter(c => c.id !== deletedId))
        setCustomers(prev => prev.filter(c => c.id !== deletedId))
        setTenants(prev => prev.filter(t => t.customer_id !== deletedId))
        setMessage(`'${hardDeleteConfirm.name}' 계정이 완전히 삭제됐습니다.`)
      }
    } finally {
      setHardDeleteSaving(false)
      setHardDeleteConfirm(null)
    }
  }

  async function createCustomer(e: React.FormEvent) {
    e.preventDefault()
    if (!customerForm.name.trim()) return
    setCustomerSaving(true)
    let ownerUserId: string | null = null
    if (customerForm.ownerEmail.trim()) {
      const { data: prof } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', customerForm.ownerEmail.trim())
        .maybeSingle()
      if (prof) ownerUserId = prof.id
      // 이메일 미발견 시 오너 미설정으로 생성 (경고만 표시)
    }
    const { data, error } = await supabase
      .from('customers')
      .insert({ name: customerForm.name.trim(), owner_user_id: ownerUserId, plan: customerForm.plan })
      .select()
      .single()
    if (error) {
      setMessage(`오류: ${error.message}`)
    } else if (data) {
      setCustomers(prev => [...prev, data as Customer])
      setShowCreateCustomer(false)
      setCustomerForm({ name: '', ownerEmail: '', plan: 'basic' })
      const ownerNotFound = customerForm.ownerEmail.trim() && !ownerUserId
      setMessage(ownerNotFound
        ? `고객이 생성됐습니다. (오너 이메일 "${customerForm.ownerEmail.trim()}"을 찾을 수 없어 미설정 상태입니다)`
        : '고객이 생성됐습니다.')
    }
    setCustomerSaving(false)
  }

  async function updateCustomerPlan(customerId: string, plan: PlanType) {
    const { data, error } = await supabase
      .from('customers')
      .update({ plan, updated_at: new Date().toISOString() })
      .eq('id', customerId)
      .select()
      .single()
    if (error) setMessage(`오류: ${error.message}`)
    else if (data) setCustomers(prev => prev.map(c => c.id === customerId ? data as Customer : c))
  }

  async function startDeleteCustomer(customer: Customer) {
    const { count } = await supabase
      .from('tenants')
      .select('*', { count: 'exact', head: true })
      .eq('customer_id', customer.id)
    setDeleteCustomerConfirm({ customer, tenantCount: count ?? 0 })
    setDeleteCustomerNameInput('')
  }

  async function confirmDeleteCustomer() {
    if (!deleteCustomerConfirm) return
    setDeleteCustomerSaving(true)
    const { error } = await supabase.from('customers').delete().eq('id', deleteCustomerConfirm.customer.id)
    if (error) {
      setMessage(`오류: ${error.message}`)
    } else {
      setCustomers(prev => prev.filter(c => c.id !== deleteCustomerConfirm.customer.id))
      setMessage('고객이 삭제됐습니다.')
    }
    setDeleteCustomerConfirm(null)
    setDeleteCustomerSaving(false)
  }

  async function toggleCustomerActive(customer: Customer) {
    const { data, error } = await supabase
      .from('customers')
      .update({ is_active: !customer.is_active, updated_at: new Date().toISOString() })
      .eq('id', customer.id)
      .select()
      .single()
    if (error) setMessage(`오류: ${error.message}`)
    else if (data) setCustomers(prev => prev.map(c => c.id === customer.id ? data as Customer : c))
  }

  async function fetchPendingMembers() {
    const { data } = await supabase
      .from('tenant_members')
      .select('id, tenant_id, user_id, role, role_id, created_at, tenant:tenants(name), profile:profiles(name, email), tenant_role:tenant_roles(name)')
      .eq('is_approved', false)
      .order('created_at', { ascending: false })
    setPendingMembers((data ?? []) as unknown as PendingMember[])
  }

  useEffect(() => {
    if (!authLoading && (!profile || !profile.is_super_admin)) navigate('/')
  }, [profile, authLoading, navigate])

  useEffect(() => {
    if (!profile?.is_super_admin) {
      setLoading(false)
      return
    }
    Promise.all([
      supabase.from('tenants').select('*').order('created_at'),
      supabase
        .from('tenant_members')
        .select('*, profile:profiles!inner(*)')
        .eq('is_approved', false)
        .eq('profiles.is_super_admin', true),
    ]).then(([tenantsRes, pendingRes]) => {
      if (tenantsRes.error) setMessage(`테넌트 로드 오류: ${tenantsRes.error.message}`)
      setTenants(tenantsRes.data ?? [])
      const admins = (pendingRes.data ?? [])
        .map((m: { profile: import('../types').Profile }) => m.profile)
        .filter(Boolean)
      // 중복 제거 (같은 유저가 여러 조직에 pending일 수 있음)
      const seen = new Set<string>()
      setPendingAdmins(admins.filter(p => { if (seen.has(p.id)) return false; seen.add(p.id); return true }))
      setLoading(false)
    })
    fetchPendingMembers()
    fetchCustomers()
  }, [profile])

  async function saveName(tenant: Tenant) {
    if (!editName.trim()) return
    setNameSaving(true)
    const { data, error } = await supabase
      .from('tenants')
      .update({ name: editName.trim(), updated_at: new Date().toISOString() })
      .eq('id', tenant.id)
      .select()
      .single()
    if (error) {
      setMessage(`오류: ${error.message}`)
    } else if (data) {
      setTenants(prev => prev.map(t => t.id === tenant.id ? data : t))
      setEditingNameId(null)
      setMessage('조직명이 수정됐습니다.')
    }
    setNameSaving(false)
  }

  async function saveSlug(tenant: Tenant) {
    const slug = editSlug.trim()
    if (!slug) return
    if (!SLUG_RE.test(slug)) { setMessage('오류: Slug는 소문자 영문·숫자와 하이픈(-)만 사용할 수 있습니다.'); return }
    if (tenants.some(t => t.id !== tenant.id && t.slug === slug)) { setMessage('오류: 이미 사용 중인 Slug입니다.'); return }
    setSlugSaving(true)
    const { data, error } = await supabase
      .from('tenants')
      .update({ slug, updated_at: new Date().toISOString() })
      .eq('id', tenant.id)
      .select()
      .single()
    if (error) {
      setMessage(`오류: ${error.message}`)
    } else if (data) {
      setTenants(prev => prev.map(t => t.id === tenant.id ? data : t))
      setEditingSlugId(null)
      setMessage('Slug가 수정됐습니다.')
    }
    setSlugSaving(false)
  }

  async function deleteTenant(tenant: Tenant) {
    setDeletingSaving(true)
    const [assignRes, memberRes] = await Promise.all([
      supabase.from('assignments').select('*', { count: 'exact', head: true }).eq('tenant_id', tenant.id),
      supabase.from('tenant_members').select('*', { count: 'exact', head: true }).eq('tenant_id', tenant.id),
    ])
    setDeleteConfirm({ tenant, assignCount: assignRes.count ?? 0, memberCount: memberRes.count ?? 0 })
    setDeleteNameInput('')
    setDeletingSaving(false)
  }

  async function deactivateTenant() {
    if (!deleteConfirm) return
    setDeletingSaving(true)
    const { data, error } = await supabase
      .from('tenants')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', deleteConfirm.tenant.id)
      .select().single()
    if (error) {
      setMessage(`오류: ${error.message}`)
    } else if (data) {
      setTenants(prev => prev.map(t => t.id === deleteConfirm.tenant.id ? data : t))
      setMessage('조직이 비활성화됐습니다.')
    }
    setDeleteConfirm(null)
    setDeletingSaving(false)
  }

  async function reactivateTenant(tenant: Tenant) {
    const { data, error } = await supabase
      .from('tenants')
      .update({ is_active: true, updated_at: new Date().toISOString() })
      .eq('id', tenant.id)
      .select().single()
    if (error) {
      setMessage(`오류: ${error.message}`)
    } else if (data) {
      setTenants(prev => prev.map(t => t.id === tenant.id ? data : t))
      setMessage('조직이 복구됐습니다.')
    }
  }

  async function confirmDeleteTenant() {
    if (!deleteConfirm) return
    setDeletingSaving(true)
    const { error } = await supabase.from('tenants').delete().eq('id', deleteConfirm.tenant.id)
    if (error) {
      setMessage(`오류: ${error.message}`)
    } else {
      setTenants(prev => prev.filter(t => t.id !== deleteConfirm.tenant.id))
      setMessage('조직이 영구 삭제됐습니다.')
    }
    setDeleteConfirm(null)
    setDeletingSaving(false)
  }

  async function confirmModeChange() {
    if (!pendingModeChange) return
    setModeSaving(true)
    const { data, error } = await supabase
      .from('tenants')
      .update({ settings: { ...pendingModeChange.tenant.settings, tenant_mode: pendingModeChange.to } })
      .eq('id', pendingModeChange.tenant.id)
      .select().single()
    if (!error && data) setTenants(prev => prev.map(x => x.id === pendingModeChange.tenant.id ? data : x))
    setPendingModeChange(null)
    setModeSaving(false)
  }

  const createTenant = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!createOrgCustomerId) {
      setMessage('오류: 조직을 생성할 고객 계정을 선택해 주세요.')
      return
    }
    const slugTrimmed = form.slug.trim()
    if (!SLUG_RE.test(slugTrimmed)) {
      setMessage('오류: Slug는 소문자 영문·숫자와 하이픈(-)만 사용할 수 있습니다. (예: my-org)')
      return
    }
    const duplicate = tenants.find(t => t.slug === slugTrimmed)
    if (duplicate) {
      setMessage('오류: 이미 사용 중인 Slug입니다.')
      return
    }
    const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/
    if (form.theme_color && !HEX_COLOR_RE.test(form.theme_color.trim())) {
      setMessage('오류: 테마 색상은 #RRGGBB 형식으로 입력해주세요. (예: #2563eb)')
      return
    }
    if (createSlots.length === 0) { setMessage('슬롯을 하나 이상 등록해야 합니다.'); return }
    setSaving(true)
    setMessage('')
    const hasHalf = createSlots.some(s => s.includes('.'))
    const { data, error } = await supabase
      .from('tenants')
      .insert({
        slug: slugTrimmed,
        name: form.name.trim(),
        business_type: form.business_type.trim() || null,
        customer_id: createOrgCustomerId,
        settings: {
          title: form.title.trim() || form.name.trim(),
          theme_color: form.theme_color.trim() || undefined,
          time_slots: createSlots,
          open_from: '09:00',
          open_to: '22:00',
          slot_interval_minutes: hasHalf ? 30 : 60,
          timezone: 'Asia/Seoul',
          locale: 'ko-KR',
          tenant_mode: form.tenant_mode,
        },
      })
      .select()
      .single()
    if (error) {
      setMessage(`오류: ${error.message}`)
    } else if (data) {
      // Create initial schedule_rules for all 7 days × all slots (is_open: true)
      const ruleRows = [0, 1, 2, 3, 4, 5, 6].flatMap(day =>
        createSlots.map(slot => ({ tenant_id: data.id, day_of_week: day, time_slot: slot, is_open: true }))
      )
      await supabase.from('schedule_rules').insert(ruleRows)

      setTenants(prev => [...prev, data])
      setShowCreate(false)
      setForm(EMPTY_FORM)
      setCreateSlots(['10-12', '13-14', '14-16', '16-18', '20-22'])
      setMessage('조직이 생성됐습니다.')
    }
    setSaving(false)
  }, [form, createSlots, createOrgCustomerId])

  if (authLoading || loading) {
    return <div className="min-h-screen flex items-center justify-center text-[var(--color-text-secondary)]">로딩 중...</div>
  }

  if (!profile?.is_super_admin) return null

  const inputCls = 'w-full px-3 py-2 rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-primary)]/30 focus:border-[var(--color-brand-primary)]'

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <div className="max-w-[880px] mx-auto" style={{ padding: 'clamp(16px,3vw,30px) clamp(14px,4vw,26px) 90px' }}>

        {/* ── Topbar ── */}
        <div className="flex items-center gap-[14px] mb-[clamp(18px,3vw,26px)]">
          <h1 className="m-0 text-[clamp(22px,5vw,28px)] font-extrabold tracking-[-0.8px] flex items-center gap-[10px] whitespace-nowrap">
            <span className="w-[30px] h-[30px] rounded-[9px] flex-shrink-0 grid place-items-center" style={{ background: 'oklch(0.95 0.045 28)', color: 'oklch(0.45 0.14 28)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M3 17l2-9 4.5 5L12 6l2.5 7L19 8l2 9z"/><path d="M3 20h18"/></svg>
            </span>
            슈퍼관리자
          </h1>
          <button onClick={() => navigate('/')} className="ml-auto inline-flex items-center gap-[6px] whitespace-nowrap text-[13.5px] font-semibold text-[var(--color-text-muted)] px-3 py-2 rounded-[10px] hover:bg-[var(--color-surface)] hover:text-[var(--color-text-primary)] transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
            돌아가기
          </button>
        </div>

        {message && (
          <div className={`mb-4 p-3 rounded-xl text-sm ${message.startsWith('오류') ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400' : 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'}`}>
            {message}
          </div>
        )}

        {/* ── 관리자 승인 대기 ── */}
        {pendingAdmins.length > 0 && (
          <div className="mb-8">
            <h2 className="m-0 text-[16px] font-bold tracking-[-0.3px] text-[var(--color-text-secondary)] mb-4 flex items-center gap-2 whitespace-nowrap">
              관리자 승인 대기
              <span className="inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold rounded-full bg-red-500 text-white">{pendingAdmins.length}</span>
            </h2>
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[22px] overflow-hidden shadow-[var(--shadow-sm)]">
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
                            onClick={async () => {
                              const { error } = await supabase
                                .from('tenant_members')
                                .update({ is_approved: true })
                                .eq('user_id', p.id)
                                .eq('is_approved', false)
                              if (error) setMessage(`승인 오류: ${error.message}`)
                              else setPendingAdmins(prev => prev.filter(a => a.id !== p.id))
                            }}
                            className="px-3 py-1 text-xs font-medium rounded-lg bg-green-500 text-white hover:bg-green-600 transition-colors"
                          >
                            승인
                          </button>
                          <button
                            onClick={async () => {
                              if (!confirm(`"${p.name}"의 가입을 거절할까요? (프로필이 삭제됩니다)`)) return
                              const { error } = await supabase.from('profiles').delete().eq('id', p.id)
                              if (error) setMessage(`거절 오류: ${error.message}`)
                              else setPendingAdmins(prev => prev.filter(a => a.id !== p.id))
                            }}
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
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <h2 className="m-0 text-[16px] font-bold tracking-[-0.3px] text-[var(--color-text-secondary)] flex items-center gap-2 whitespace-nowrap">
                승인 대기
                <span className="inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold rounded-full bg-amber-500 text-white">{pendingMembers.length}</span>
              </h2>
              <button
                disabled={selectedMemberIds.size === 0 || approving}
                onClick={async () => {
                  if (selectedMemberIds.size === 0) return
                  setApproving(true)
                  const { error } = await supabase
                    .from('tenant_members')
                    .update({ is_approved: true })
                    .in('id', Array.from(selectedMemberIds))
                  if (error) {
                    setMessage(`승인 오류: ${error.message}`)
                  } else {
                    setMessage(`${selectedMemberIds.size}건 승인 완료`)
                    setSelectedMemberIds(new Set())
                    await fetchPendingMembers()
                  }
                  setApproving(false)
                }}
                className="ml-auto px-4 py-2 text-sm font-semibold rounded-xl bg-green-500 text-white hover:bg-green-600 disabled:opacity-40 transition-colors"
              >
                {approving ? '처리 중...' : `선택 승인${selectedMemberIds.size > 0 ? ` (${selectedMemberIds.size})` : ''}`}
              </button>
            </div>
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[22px] overflow-hidden shadow-[var(--shadow-sm)]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[var(--color-surface-secondary)] border-b border-[var(--color-border)]">
                    <th className="px-4 py-3">
                      <input
                        type="checkbox"
                        className="accent-[var(--color-brand-primary)] w-4 h-4"
                        checked={selectedMemberIds.size === pendingMembers.length && pendingMembers.length > 0}
                        onChange={e => {
                          if (e.target.checked) setSelectedMemberIds(new Set(pendingMembers.map(m => m.id)))
                          else setSelectedMemberIds(new Set())
                        }}
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
                      onClick={() => setSelectedMemberIds(prev => {
                        const next = new Set(prev)
                        if (next.has(m.id)) next.delete(m.id); else next.add(m.id)
                        return next
                      })}
                    >
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          className="accent-[var(--color-brand-primary)] w-4 h-4"
                          checked={selectedMemberIds.has(m.id)}
                          onChange={() => setSelectedMemberIds(prev => {
                            const next = new Set(prev)
                            if (next.has(m.id)) next.delete(m.id); else next.add(m.id)
                            return next
                          })}
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

        {/* 탈퇴 요청 중 고객 */}
        {deletionRequests.length > 0 && (
          <section className="mb-8">
            <h2 className="text-[15px] font-bold text-red-600 mb-3">
              탈퇴 요청 중 ({deletionRequests.length})
            </h2>
            <ul className="flex flex-col gap-2">
              {deletionRequests.map(c => {
                if (!c.deletion_requested_at) return null
                const elapsed = Math.floor((Date.now() - new Date(c.deletion_requested_at).getTime()) / 86_400_000)
                const canDelete = elapsed >= 30
                return (
                  <li key={c.id} className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <span className="font-semibold text-sm text-[var(--color-text-primary)]">{c.name}</span>
                      <span className="ml-2 text-xs text-red-500">{elapsed}일 경과</span>
                      {canDelete && (
                        <span className="ml-2 text-[11px] font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded">삭제 가능</span>
                      )}
                    </div>
                    <button
                      onClick={() => restoreCustomer(c)}
                      disabled={restoringId === c.id}
                      className="px-3 py-1.5 rounded-lg border border-[var(--color-border)] bg-white text-xs font-semibold text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] transition-colors disabled:opacity-50"
                    >
                      복구
                    </button>
                    <button
                      onClick={() => setHardDeleteConfirm(c)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                        canDelete
                          ? 'bg-red-600 text-white hover:bg-red-700'
                          : 'border border-red-300 text-red-500 hover:bg-red-100'
                      }`}
                    >
                      완전 삭제{!canDelete && ' ⚠'}
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        )}

        {/* ── 고객 관리 ── */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <h2 className="m-0 text-[16px] font-bold tracking-[-0.3px] text-[var(--color-text-secondary)] flex items-baseline gap-[7px] whitespace-nowrap">
              고객 관리
              <span className="text-[12.5px] font-bold px-[9px] py-[2px] rounded-full" style={{ color: 'oklch(0.45 0.14 28)', background: 'oklch(0.95 0.045 28)' }}>
                {customers.length}
              </span>
            </h2>
            <button
              onClick={() => setShowCreateCustomer(v => !v)}
              className="ml-auto inline-flex items-center justify-center gap-[6px] h-[36px] px-[14px] rounded-[10px] text-[13px] font-bold whitespace-nowrap border border-[var(--color-border-strong)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] transition-colors"
            >
              + 새 고객
            </button>
          </div>

          {showCreateCustomer && (
            <form onSubmit={createCustomer} className="mb-4 p-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] space-y-3">
              <h3 className="font-semibold text-sm text-[var(--color-text-primary)]">새 고객 등록</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-[var(--color-text-secondary)] mb-1">고객명 *</label>
                  <input type="text" required value={customerForm.name} onChange={e => setCustomerForm(p => ({ ...p, name: e.target.value }))} placeholder="홍길동 미용실" className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs text-[var(--color-text-secondary)] mb-1">오너 이메일 (선택)</label>
                  <input type="email" value={customerForm.ownerEmail} onChange={e => setCustomerForm(p => ({ ...p, ownerEmail: e.target.value }))} placeholder="owner@example.com" className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs text-[var(--color-text-secondary)] mb-1">플랜</label>
                  <select value={customerForm.plan} onChange={e => setCustomerForm(p => ({ ...p, plan: e.target.value as PlanType }))}
                    className="w-full px-3 py-2 rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-surface)] text-sm text-[var(--color-text-primary)] focus:outline-none">
                    <option value="basic">Basic (무료)</option>
                    <option value="pro">Pro</option>
                    <option value="business">Business</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={customerSaving} className="px-4 py-2 rounded-xl bg-[var(--color-brand-primary)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-40">
                  {customerSaving ? '저장 중...' : '생성'}
                </button>
                <button type="button" onClick={() => setShowCreateCustomer(false)} className="px-4 py-2 rounded-xl border border-[var(--color-border)] text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]">취소</button>
              </div>
            </form>
          )}

          {customers.length > 0 && (
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[22px] overflow-hidden shadow-[var(--shadow-sm)]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[var(--color-surface-secondary)] border-b border-[var(--color-border)]">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)]">고객명</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)]">플랜</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)] hidden sm:table-cell">조직 수</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)]">오너</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)] hidden md:table-cell">가입일</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)]">상태</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {customers.map(c => (
                    <tr key={c.id} className="hover:bg-[var(--color-surface-hover)]">
                      <td className="px-4 py-3 font-semibold text-[var(--color-text-primary)]">
                        {c.name}
                        {c.id === '00000000-0000-0000-0000-000000000001' && (
                          <span className="ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--color-surface-secondary)] text-[var(--color-text-muted)]">시스템</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={c.plan}
                          onChange={e => updateCustomerPlan(c.id, e.target.value as PlanType)}
                          className="px-2 py-1 rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-surface)] text-xs text-[var(--color-text-secondary)] focus:outline-none"
                        >
                          <option value="basic">Basic</option>
                          <option value="pro">Pro</option>
                          <option value="business">Business</option>
                        </select>
                      </td>
                      <td className="px-4 py-3 text-[var(--color-text-muted)] text-xs hidden sm:table-cell">
                        {tenants.filter(t => t.customer_id === c.id).length}개
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {editingOwnerCustomerId === c.id ? (
                          <div className="flex items-center gap-1">
                            <input
                              value={editOwnerEmail}
                              onChange={e => setEditOwnerEmail(e.target.value)}
                              placeholder="이메일 입력"
                              className="text-xs px-2 py-1 rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-text-primary)] w-36 focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-primary)]/30 focus:border-[var(--color-brand-primary)]"
                              onKeyDown={e => { if (e.key === 'Enter') saveOwner(c.id); if (e.key === 'Escape') setEditingOwnerCustomerId(null) }}
                              autoFocus
                            />
                            <button onClick={() => saveOwner(c.id)} disabled={ownerSaving}
                              className="px-1.5 py-0.5 text-xs bg-[var(--color-brand-primary)] text-white rounded-lg disabled:opacity-40">
                              {ownerSaving ? '...' : '저장'}
                            </button>
                            <button onClick={() => setEditingOwnerCustomerId(null)}
                              className="px-1.5 py-0.5 text-xs border border-[var(--color-border-strong)] text-[var(--color-text-secondary)] rounded-lg">취소</button>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setEditingOwnerCustomerId(c.id)
                              setEditOwnerEmail(c.owner_user_id ? (ownerEmails[c.owner_user_id] ?? '') : '')
                            }}
                            className="flex items-center gap-1 text-[var(--color-text-muted)] hover:text-[var(--color-brand-primary)] transition-colors group"
                          >
                            <span>{c.owner_user_id ? (ownerEmails[c.owner_user_id] ?? '...') : '미설정'}</span>
                            <svg className="opacity-0 group-hover:opacity-100 transition-opacity" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[var(--color-text-muted)] text-xs hidden md:table-cell">{c.created_at.slice(0, 10)}</td>
                      <td className="px-4 py-3">
                        {c.id !== '00000000-0000-0000-0000-000000000001' && (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => toggleCustomerActive(c)}
                              className={`px-2 py-1 text-[11px] font-semibold rounded-lg transition-colors ${c.is_active
                                ? 'border border-amber-200 text-amber-700 hover:bg-amber-50'
                                : 'border border-green-200 text-green-700 hover:bg-green-50'}`}
                            >
                              {c.is_active ? '비활성화' : '복구'}
                            </button>
                            <button
                              onClick={() => startDeleteCustomer(c)}
                              className="px-2 py-1 text-[11px] font-semibold rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                            >
                              삭제
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Customer delete modal */}
        {deleteCustomerConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] p-6 w-full max-w-sm space-y-4 shadow-xl">
              <h3 className="font-bold text-[var(--color-text-primary)] text-lg">고객 삭제</h3>
              <div className="text-sm text-[var(--color-text-secondary)] space-y-1">
                <p>고객명: <span className="font-semibold text-[var(--color-text-primary)]">{deleteCustomerConfirm.customer.name}</span></p>
                <p>소속 조직: <span className="font-semibold">{deleteCustomerConfirm.tenantCount}개</span></p>
              </div>
              {deleteCustomerConfirm.tenantCount > 0 && (
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-xs text-amber-700 dark:text-amber-400">
                  소속 조직 {deleteCustomerConfirm.tenantCount}개와 모든 데이터(배정, 회원 등)가 영구 삭제됩니다.
                </div>
              )}
              <p className="text-xs text-red-500">이 작업은 되돌릴 수 없습니다. 고객명을 입력해 확인하세요.</p>
              <input
                value={deleteCustomerNameInput}
                onChange={e => setDeleteCustomerNameInput(e.target.value)}
                placeholder={`"${deleteCustomerConfirm.customer.name}" 입력`}
                className="w-full px-3 py-2 rounded-xl border border-red-200 dark:border-red-700 bg-[var(--color-surface)] text-sm focus:outline-none focus:ring-2 focus:ring-red-400/30 focus:border-red-400"
              />
              <div className="flex gap-2">
                <button
                  disabled={deleteCustomerNameInput !== deleteCustomerConfirm.customer.name || deleteCustomerSaving}
                  onClick={confirmDeleteCustomer}
                  className="flex-1 px-4 py-2 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-600 disabled:opacity-40 transition-colors"
                >
                  {deleteCustomerSaving ? '삭제 중...' : '영구 삭제'}
                </button>
                <button
                  onClick={() => setDeleteCustomerConfirm(null)}
                  className="flex-1 px-4 py-2 rounded-xl border border-[var(--color-border)] text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]"
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── List header ── */}
        {(() => {
          const filteredTenants = filterCustomerId ? tenants.filter(t => t.customer_id === filterCustomerId) : tenants
          return (
            <>
              <div className="flex items-center gap-[14px] flex-wrap mb-[14px]">
                <h2 className="m-0 text-[16px] font-bold tracking-[-0.3px] text-[var(--color-text-secondary)] flex items-baseline gap-[7px] whitespace-nowrap">
                  조직 목록
                  <span className="text-[12.5px] font-bold px-[9px] py-[2px] rounded-full" style={{ color: 'oklch(0.45 0.14 28)', background: 'oklch(0.95 0.045 28)' }}>
                    {filteredTenants.length}{filterCustomerId ? `/${tenants.length}` : ''}
                  </span>
                </h2>
                <select
                  value={filterCustomerId}
                  onChange={e => setFilterCustomerId(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-surface)] text-sm text-[var(--color-text-secondary)] focus:outline-none focus:border-[var(--color-brand-primary)]"
                >
                  <option value="">전체 고객</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <button
                  onClick={() => setShowCreate(v => !v)}
                  className="ml-auto inline-flex items-center justify-center gap-[6px] h-[40px] px-[17px] rounded-[11px] text-[13.5px] font-bold tracking-[-0.2px] whitespace-nowrap text-white transition-colors hover:opacity-90 active:translate-y-px"
                  style={{ background: 'var(--color-brand-primary)', boxShadow: '0 6px 14px -8px var(--color-brand-primary)' }}
                >
                  + 새 조직
                </button>
              </div>

        {/* Create form */}
        {showCreate && (
          <form onSubmit={createTenant} className="mb-6 p-5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] space-y-4">
            <h3 className="font-semibold text-[var(--color-text-primary)]">새 조직 만들기</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {([
                { key: 'slug',        label: 'Slug (소문자+하이픈)', placeholder: 'my-org',    required: true,  maxLength: 50 },
                { key: 'name',        label: '조직명',               placeholder: '한서미용실', required: true,  maxLength: 50 },
                { key: 'title',       label: '페이지 타이틀 (선택)',  placeholder: '스케줄',                    maxLength: 50 },
                { key: 'theme_color', label: '테마 색상 (선택)',      placeholder: '#2563eb',                   maxLength: 7  },
              ] as { key: keyof CreateForm; label: string; placeholder: string; required?: boolean; maxLength?: number }[]).map(f => (
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
              <label className="block text-xs text-[var(--color-text-secondary)] mb-1">고객 계정</label>
              <select
                value={createOrgCustomerId}
                onChange={e => setCreateOrgCustomerId(e.target.value)}
                className={inputCls}
              >
                <option value="">고객 계정 없음</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
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
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 rounded-xl border border-[var(--color-border)] text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]"
              >
                취소
              </button>
            </div>
          </form>
        )}

        {/* Delete confirmation modal */}
        {deleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] p-6 w-full max-w-sm space-y-4 shadow-xl">
              <h3 className="font-bold text-[var(--color-text-primary)] text-lg">조직 삭제</h3>
              <div className="text-sm text-[var(--color-text-secondary)] space-y-0.5">
                <p>조직명: <span className="font-semibold text-[var(--color-text-primary)]">{deleteConfirm.tenant.name}</span></p>
                <p>회원 <span className="font-semibold">{deleteConfirm.memberCount}명</span> · 배정 <span className="font-semibold">{deleteConfirm.assignCount}건</span></p>
              </div>

              {/* Option 1: 비활성화 */}
              <div className="p-3 rounded-xl border border-amber-200 dark:border-amber-800 space-y-2">
                <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">비활성화 (권장)</p>
                <p className="text-xs text-[var(--color-text-secondary)]">데이터를 보존하고 조직을 숨깁니다. 나중에 복구할 수 있습니다.</p>
                <button
                  disabled={deletingSaving}
                  onClick={deactivateTenant}
                  className="w-full px-4 py-2 rounded-xl bg-amber-500 text-white text-sm font-medium hover:bg-amber-600 disabled:opacity-40 transition-colors"
                >
                  {deletingSaving ? '처리 중...' : '비활성화'}
                </button>
              </div>

              {/* Option 2: 영구 삭제 */}
              <div className="p-3 rounded-xl border border-red-200 dark:border-red-800 space-y-2">
                <p className="text-sm font-semibold text-red-600 dark:text-red-400">영구 삭제</p>
                <p className="text-xs text-red-500">모든 데이터가 완전히 삭제되며 복구 불가능합니다.</p>
                <input
                  value={deleteNameInput}
                  onChange={e => setDeleteNameInput(e.target.value)}
                  placeholder={`조직명 "${deleteConfirm.tenant.name}" 입력`}
                  className="w-full px-3 py-2 rounded-xl border border-red-200 dark:border-red-700 bg-[var(--color-surface)] text-sm focus:outline-none focus:ring-2 focus:ring-red-400/30 focus:border-red-400"
                />
                <button
                  disabled={deleteNameInput !== deleteConfirm.tenant.name || deletingSaving}
                  onClick={confirmDeleteTenant}
                  className="w-full px-4 py-2 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-600 disabled:opacity-40 transition-colors"
                >
                  {deletingSaving ? '삭제 중...' : '영구 삭제'}
                </button>
              </div>

              <button
                onClick={() => setDeleteConfirm(null)}
                className="w-full px-4 py-2 rounded-xl border border-[var(--color-border)] text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]"
              >
                취소
              </button>
            </div>
          </div>
        )}

        {/* Mode change warning modal */}
        {pendingModeChange && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] p-6 w-full max-w-sm space-y-4 shadow-xl">
              <h3 className="font-bold text-[var(--color-text-primary)] text-lg">운영 모드 변경</h3>
              <p className="text-sm text-[var(--color-text-secondary)]">
                <span className="font-semibold text-[var(--color-text-primary)]">{pendingModeChange.tenant.name}</span>의 모드를{' '}
                <span className="font-semibold">{pendingModeChange.from}</span> →{' '}
                <span className="font-semibold text-[var(--color-brand-primary)]">{pendingModeChange.to}</span>으로 변경합니다.
              </p>
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-xs text-amber-700 dark:text-amber-400 space-y-1">
                {pendingModeChange.to === '비회원' && (
                  <p>기존 회원 배정이 화면에 남아 비회원 직접입력 데이터와 혼재될 수 있습니다.</p>
                )}
                {pendingModeChange.from === '비회원' && pendingModeChange.to === '회원개별' && (
                  <p>기존 비회원 배정 <strong>{pendingModeChange.unassignedCount ?? 0}건</strong>은 일반 회원 화면에서 숨겨집니다. 관리자는 계속 볼 수 있습니다.</p>
                )}
                {pendingModeChange.from === '비회원' && pendingModeChange.to === '회원공유' && (
                  <p>기존 비회원 배정 <strong>{pendingModeChange.unassignedCount ?? 0}건</strong>이 공개 스케줄에 표시됩니다.</p>
                )}
                {pendingModeChange.from !== '비회원' && pendingModeChange.to === '회원개별' && (
                  <p>각 회원은 자신의 배정만 볼 수 있습니다. 기존 배정은 그대로 유지됩니다.</p>
                )}
                {pendingModeChange.from !== '비회원' && pendingModeChange.to === '회원공유' && (
                  <p>기존 배정 데이터는 그대로 유지됩니다.</p>
                )}
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  disabled={modeSaving}
                  onClick={confirmModeChange}
                  className="flex-1 px-4 py-2 rounded-xl bg-[var(--color-brand-primary)] text-white text-sm font-medium hover:bg-[var(--color-brand-primary-hover)] disabled:opacity-40"
                >
                  {modeSaving ? '저장 중...' : '변경 적용'}
                </button>
                <button
                  onClick={() => setPendingModeChange(null)}
                  className="flex-1 px-4 py-2 rounded-xl border border-[var(--color-border)] text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]"
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        )}

              {/* ── Org list ── */}
              <ul className="flex flex-col gap-3">
                {filteredTenants.length === 0 && (
                  <li className="text-center py-10 text-[var(--color-text-secondary)] text-sm">
                    {filterCustomerId ? '해당 고객의 조직이 없습니다.' : '조직이 없습니다.'}
                  </li>
                )}
                {filteredTenants.map(t => (
            <li
              key={t.id}
              className={`grid [grid-template-columns:1fr_auto] items-start md:[grid-template-columns:minmax(0,1fr)_auto_auto_auto] md:items-center gap-x-[14px] gap-y-[13px] md:gap-[18px] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[22px] shadow-[var(--shadow-sm)] transition-all duration-150 hover:-translate-y-px hover:shadow-[var(--shadow-md)] hover:border-[var(--color-border-strong)] ${t.is_active === false ? 'opacity-60' : ''}`}
              style={{ padding: '16px clamp(16px,3vw,22px)' }}
            >
              {/* orgMain */}
              <div className="min-w-0">
                {editingNameId === t.id ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    <input
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      className="text-sm font-semibold px-2 py-1 rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-text-primary)] w-40 focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-primary)]/30 focus:border-[var(--color-brand-primary)]"
                      onKeyDown={e => { if (e.key === 'Enter') saveName(t); if (e.key === 'Escape') setEditingNameId(null) }}
                      autoFocus
                    />
                    <button onClick={() => saveName(t)} disabled={nameSaving}
                      className="px-2 py-1 text-xs bg-[var(--color-brand-primary)] text-white rounded-lg disabled:opacity-40">
                      {nameSaving ? '...' : '저장'}
                    </button>
                    <button onClick={() => setEditingNameId(null)}
                      className="px-2 py-1 text-xs border border-[var(--color-border-strong)] text-[var(--color-text-secondary)] rounded-lg hover:bg-[var(--color-surface-secondary)]">
                      취소
                    </button>
                  </div>
                ) : (
                  <div className="flex items-baseline gap-[9px] flex-wrap">
                    <button
                      onClick={() => { setEditingNameId(t.id); setEditName(t.name); setEditingSlugId(null) }}
                      className="text-[16.5px] font-bold tracking-[-0.4px] whitespace-nowrap text-left hover:text-[var(--color-brand-primary)] transition-colors"
                    >
                      {t.name}
                    </button>
                    {editingSlugId === t.id ? (
                      <span className="inline-flex items-center gap-1">
                        <input
                          value={editSlug}
                          onChange={e => setEditSlug(e.target.value)}
                          className="text-xs font-mono px-2 py-0.5 rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-text-primary)] w-28 focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-primary)]/30 focus:border-[var(--color-brand-primary)]"
                          onKeyDown={e => { if (e.key === 'Enter') saveSlug(t); if (e.key === 'Escape') setEditingSlugId(null) }}
                          autoFocus
                        />
                        <button onClick={() => saveSlug(t)} disabled={slugSaving}
                          className="px-1.5 py-0.5 text-xs bg-[var(--color-brand-primary)] text-white rounded-lg disabled:opacity-40">
                          {slugSaving ? '...' : '저장'}
                        </button>
                        <button onClick={() => setEditingSlugId(null)}
                          className="px-1.5 py-0.5 text-xs border border-[var(--color-border-strong)] text-[var(--color-text-secondary)] rounded-lg">취소</button>
                      </span>
                    ) : (
                      <button
                        onClick={() => { setEditingSlugId(t.id); setEditSlug(t.slug); setEditingNameId(null) }}
                        className="text-[12.5px] font-medium font-mono text-[var(--color-text-muted)] hover:text-[var(--color-brand-primary)] transition-colors"
                      >
                        {t.slug}
                      </button>
                    )}
                  </div>
                )}
                {t.is_active === false && (
                  <div className="mt-[5px]">
                    <span className="text-[11px] font-semibold px-[7px] py-[2px] rounded-md bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">비활성</span>
                  </div>
                )}
              </div>

              {/* orgCat */}
              <span className="self-start md:self-auto text-[12px] font-bold text-[var(--color-text-secondary)] px-[11px] py-[5px] rounded-full whitespace-nowrap" style={{ background: 'var(--color-surface-hover)', justifySelf: 'end' }}>
                {t.business_type || '-'}
              </span>

              {/* shareSel */}
              <div className="[grid-column:1/-1] md:[grid-column:auto] flex flex-col gap-1">
                <span className="block md:hidden text-[11px] font-bold text-[var(--color-text-muted)]">공유 모드</span>
                <select
                  value={displayMode(t.settings?.tenant_mode)}
                  disabled={modeSaving}
                  onChange={async e => {
                    const newMode = e.target.value as TenantMode
                    const fromMode = displayMode(t.settings?.tenant_mode)
                    if (newMode === fromMode) return
                    let unassignedCount: number | undefined
                    if (fromMode === '비회원' && (newMode === '회원개별' || newMode === '회원공유')) {
                      const { count } = await supabase.from('assignments')
                        .select('*', { count: 'exact', head: true })
                        .eq('tenant_id', t.id).is('user_id', null)
                      unassignedCount = count ?? 0
                    }
                    setPendingModeChange({ tenant: t, from: fromMode, to: newMode, unassignedCount })
                  }}
                  className="h-[40px] md:h-[36px] w-full md:w-auto pl-3 pr-8 bg-[var(--color-surface-secondary)] border border-[var(--color-border-strong)] rounded-[9px] text-[13px] font-semibold text-[var(--color-text-secondary)] outline-none appearance-none cursor-pointer disabled:opacity-40 focus:border-[var(--color-brand-primary)]"
                  style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%238A8F99' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E\")", backgroundRepeat: 'no-repeat', backgroundPosition: 'right 9px center' }}
                >
                  <option value="회원공유">회원공유</option>
                  <option value="회원개별">회원개별</option>
                  <option value="비회원">비회원</option>
                </select>
              </div>

              {/* orgActions */}
              <div className="[grid-column:1/-1] md:[grid-column:auto] grid grid-cols-3 md:flex md:items-center gap-2 md:gap-[7px] pt-2 border-t border-[var(--color-border)] md:pt-0 md:border-none">
                <button
                  onClick={() => { setTenant(t, 'admin'); navigate('/') }}
                  className="inline-flex items-center justify-center h-[40px] md:h-[36px] px-3 md:px-[13px] rounded-[9px] text-[12.5px] font-semibold border border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] shadow-[var(--shadow-xs)] hover:bg-[var(--color-surface-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
                >
                  스케줄
                </button>
                <button
                  onClick={() => navigate(`/admin?org=${t.id}`)}
                  className="inline-flex items-center justify-center h-[40px] md:h-[36px] px-3 md:px-[13px] rounded-[9px] text-[12.5px] font-semibold text-white transition-colors hover:opacity-90"
                  style={{ background: 'var(--color-brand-primary)' }}
                >
                  관리
                </button>
                {t.is_active === false ? (
                  <button
                    onClick={() => reactivateTenant(t)}
                    className="inline-flex items-center justify-center h-[40px] md:h-[36px] px-3 md:px-[13px] rounded-[9px] text-[12.5px] font-semibold border border-green-200 text-green-600 hover:bg-green-50 dark:border-green-800 dark:text-green-400 transition-colors"
                  >
                    복구
                  </button>
                ) : (
                  <button
                    disabled={deletingSaving}
                    onClick={() => deleteTenant(t)}
                    className="inline-flex items-center justify-center h-[40px] md:h-[36px] px-3 md:px-[13px] rounded-[9px] text-[12.5px] font-semibold bg-[var(--color-surface)] border transition-colors disabled:opacity-40 hover:bg-[var(--color-surface-secondary)]"
                    style={{ borderColor: 'color-mix(in srgb, var(--color-brand-primary) 30%, var(--color-border))', color: 'oklch(0.45 0.14 28)' }}
                  >
                    삭제
                  </button>
                )}
              </div>
            </li>
                ))}
              </ul>
            </>
          )
        })()}
      </div>

      {/* 완전 삭제 확인 모달 */}
      {hardDeleteConfirm && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(20,23,28,0.55)', backdropFilter: 'blur(4px)' }}
            onClick={() => { if (!hardDeleteSaving) setHardDeleteConfirm(null) }}
          />
          <div style={{ position: 'fixed', inset: 0, zIndex: 201, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <div style={{ background: 'var(--color-surface, #fff)', borderRadius: 18, padding: '24px', width: '100%', maxWidth: 360, boxShadow: '0 22px 60px -28px rgba(20,23,28,0.35)', fontFamily: 'inherit' }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: '#14171C', margin: '0 0 8px' }}>완전 삭제 확인</h2>
              <p style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.6, margin: '0 0 20px' }}>
                <strong>{hardDeleteConfirm.name}</strong> 계정과 소속된 모든 조직, 배정, 회원 데이터가
                영구 삭제됩니다. <strong>이 작업은 되돌릴 수 없습니다.</strong>
              </p>
              <button
                onClick={executeHardDelete}
                disabled={hardDeleteSaving}
                style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: 'none', background: '#dc2626', color: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 600, marginBottom: 8, opacity: hardDeleteSaving ? 0.5 : 1 }}
              >
                {hardDeleteSaving ? '삭제 중...' : '완전 삭제'}
              </button>
              <button
                onClick={() => setHardDeleteConfirm(null)}
                disabled={hardDeleteSaving}
                style={{ width: '100%', height: 38, fontSize: 13, color: '#8A8F99', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
              >
                취소
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
