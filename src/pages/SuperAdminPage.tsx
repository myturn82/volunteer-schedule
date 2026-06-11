import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useTenant } from '../contexts/TenantContext'
import type { Tenant, TenantMode, Customer, PlanType, Profile } from '../types'
import { AccountRail } from '../components/superadmin/AccountRail'
import { HubMain, type HubView } from '../components/superadmin/HubMain'
import { OrgDrawer, type DrawerMember } from '../components/superadmin/OrgDrawer'
import { PendingApprovalsBanner, type PendingMember } from '../components/superadmin/PendingApprovalsBanner'
import { PlanLimitsPanel } from '../components/superadmin/PlanLimitsPanel'
import { EMPTY_ORG_FORM, SLUG_RE, type CreateOrgForm } from '../components/superadmin/createOrgForm'
import { displayMode } from '../lib/tenantMode'
import { isValidPhone } from '../lib/phone'
import '../styles/account-hub.css'

// ─── SuperAdminPage ───────────────────────────────────────────────────────────

export function SuperAdminPage() {
  const { profile, loading: authLoading } = useAuth()
  const { setTenant } = useTenant()
  const navigate = useNavigate()

  const [tenants, setTenants]       = useState<Tenant[]>([])
  const [loading, setLoading]       = useState(true)
  const [message, setMessage]       = useState('')

  // Account Hub navigation state
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [selectedTenantId, setSelectedTenantId]     = useState<string | null>(null)
  const [view, setView]             = useState<HubView>('tree')
  const [railOpen, setRailOpen]     = useState(false)

  // Member counts per tenant (approved / pending)
  const [memberCounts, setMemberCounts]             = useState<Record<string, number>>({})
  const [pendingCountsByTenant, setPendingCountsByTenant] = useState<Record<string, number>>({})

  // Drawer member list
  const [drawerMembers, setDrawerMembers]           = useState<DrawerMember[]>([])
  const [drawerMembersLoading, setDrawerMembersLoading] = useState(false)
  const [approvingMemberId, setApprovingMemberId]   = useState<string | null>(null)

  // Create form state
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm]             = useState<CreateOrgForm>(EMPTY_ORG_FORM)
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
  const [pendingAdmins, setPendingAdmins] = useState<Profile[]>([])

  // Pending member approvals (all non-admin users)
  const [pendingMembers, setPendingMembers] = useState<PendingMember[]>([])
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set())
  const [approving, setApproving] = useState(false)

  // Customer management state
  const [customers, setCustomers] = useState<Customer[]>([])
  const [showCreateCustomer, setShowCreateCustomer] = useState(false)
  const [customerForm, setCustomerForm] = useState({ name: '', phone: '', ownerEmail: '', plan: 'basic' as PlanType })
  const [customerSaving, setCustomerSaving] = useState(false)
  const [restoringId, setRestoringId]             = useState<string | null>(null)
  const [hardDeleteConfirm, setHardDeleteConfirm] = useState<Customer | null>(null)
  const [hardDeleteSaving, setHardDeleteSaving]   = useState(false)

  // Customer delete state
  const [deleteCustomerConfirm, setDeleteCustomerConfirm] = useState<{ customer: Customer; tenantCount: number } | null>(null)
  const [deleteCustomerSaving, setDeleteCustomerSaving] = useState(false)
  const [deleteCustomerNameInput, setDeleteCustomerNameInput] = useState('')

  // Owner edit state
  const [editingOwnerCustomerId, setEditingOwnerCustomerId] = useState<string | null>(null)
  const [editOwnerEmail, setEditOwnerEmail] = useState('')
  const [ownerSaving, setOwnerSaving] = useState(false)
  const [ownerEmails, setOwnerEmails] = useState<Record<string, string>>({})

  // Phone edit state
  const [editingPhoneCustomerId, setEditingPhoneCustomerId] = useState<string | null>(null)
  const [editPhone, setEditPhone] = useState('')
  const [phoneSaving, setPhoneSaving] = useState(false)

  async function loadOwnerEmails(customerList: Customer[]) {
    const ownerIds = customerList.map(c => c.owner_user_id).filter(Boolean) as string[]
    if (ownerIds.length === 0) return
    const { data } = await supabase.from('profiles').select('id, email').in('id', ownerIds)
    const map: Record<string, string> = {}
    for (const p of data ?? []) map[p.id] = p.email ?? '(이메일 없음)'
    setOwnerEmails(map)
  }

  async function saveOwner(customerId: string, email: string) {
    setOwnerSaving(true)
    const trimmed = email.trim()
    let ownerUserId: string | null = null
    if (trimmed) {
      const { data: prof } = await supabase.from('profiles').select('id, email').eq('email', trimmed).maybeSingle()
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
      if (ownerUserId) setOwnerEmails(prev => ({ ...prev, [ownerUserId!]: trimmed }))
      setMessage(ownerUserId ? '오너가 설정됐습니다.' : '오너가 해제됐습니다.')
    }
    setOwnerSaving(false)
  }

  async function savePhone(customerId: string, phone: string) {
    if (!isValidPhone(phone)) { setMessage('오류: 올바른 전화번호를 입력해 주세요. (예: 010-1234-5678)'); return }
    setPhoneSaving(true)
    const { data, error } = await supabase
      .from('customers')
      .update({ phone: phone.trim(), updated_at: new Date().toISOString() })
      .eq('id', customerId)
      .select()
      .single()
    if (error) { setMessage(`오류: ${error.message}`); setPhoneSaving(false); return }
    if (data) {
      setCustomers(prev => prev.map(c => c.id === customerId ? data as Customer : c))
      setMessage('전화번호가 수정됐습니다.')
    }
    setPhoneSaving(false)
  }

  async function fetchTenants() {
    const { data, error } = await supabase.from('tenants').select('*').order('created_at')
    if (error) setMessage(`테넌트 로드 오류: ${error.message}`)
    else setTenants(data ?? [])
  }

  async function fetchCustomers() {
    const { data } = await supabase.from('customers').select('*').order('created_at')
    const list = (data ?? []) as Customer[]
    setCustomers(list)
    loadOwnerEmails(list)
  }

  async function fetchMemberCounts() {
    const { data, error } = await supabase.from('tenant_members').select('tenant_id, is_approved')
    if (error) return
    const approved: Record<string, number> = {}
    const pending: Record<string, number> = {}
    for (const row of data ?? []) {
      if (row.is_approved) approved[row.tenant_id] = (approved[row.tenant_id] ?? 0) + 1
      else pending[row.tenant_id] = (pending[row.tenant_id] ?? 0) + 1
    }
    setMemberCounts(approved)
    setPendingCountsByTenant(pending)
  }

  async function fetchPendingMembers() {
    const { data } = await supabase
      .from('tenant_members')
      .select('id, tenant_id, user_id, role, role_id, created_at, tenant:tenants(name), profile:profiles(name, email), tenant_role:tenant_roles(name)')
      .eq('is_approved', false)
      .order('created_at', { ascending: false })
    setPendingMembers((data ?? []) as unknown as PendingMember[])
  }

  async function fetchDrawerMembers(tenantId: string) {
    setDrawerMembersLoading(true)
    const { data, error } = await supabase
      .from('tenant_members')
      .select('id, user_id, role, role_id, is_approved, created_at, profile:profiles(name, email), tenant_role:tenant_roles(name)')
      .eq('tenant_id', tenantId)
      .order('created_at')
    if (error) setMessage(`멤버 로드 오류: ${error.message}`)
    else setDrawerMembers((data ?? []) as unknown as DrawerMember[])
    setDrawerMembersLoading(false)
  }

  async function approveMember(memberId: string) {
    setApprovingMemberId(memberId)
    const { error } = await supabase.from('tenant_members').update({ is_approved: true }).eq('id', memberId)
    if (error) {
      setMessage(`승인 오류: ${error.message}`)
    } else {
      setDrawerMembers(prev => prev.map(m => m.id === memberId ? { ...m, is_approved: true } : m))
      await Promise.all([fetchPendingMembers(), fetchMemberCounts()])
    }
    setApprovingMemberId(null)
  }

  async function rejectMember(memberId: string) {
    if (!confirm('이 가입 신청을 거절할까요?')) return
    setApprovingMemberId(memberId)
    const { error } = await supabase.from('tenant_members').delete().eq('id', memberId)
    if (error) {
      setMessage(`거절 오류: ${error.message}`)
    } else {
      setDrawerMembers(prev => prev.filter(m => m.id !== memberId))
      await Promise.all([fetchPendingMembers(), fetchMemberCounts()])
    }
    setApprovingMemberId(null)
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
      setCustomers(prev => prev.map(c =>
        c.id === customer.id ? { ...c, is_active: true, deletion_requested_at: null } : c
      ))
      await fetchTenants()
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
        setCustomers(prev => prev.filter(c => c.id !== deletedId))
        await fetchTenants()
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
    if (!isValidPhone(customerForm.phone)) { setMessage('오류: 올바른 전화번호를 입력해 주세요. (예: 010-1234-5678)'); return }
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
      .insert({ name: customerForm.name.trim(), phone: customerForm.phone.trim(), owner_user_id: ownerUserId, plan: customerForm.plan })
      .select()
      .single()
    if (error) {
      setMessage(`오류: ${error.message}`)
    } else if (data) {
      setCustomers(prev => [...prev, data as Customer])
      setShowCreateCustomer(false)
      setCustomerForm({ name: '', phone: '', ownerEmail: '', plan: 'basic' })
      setSelectedCustomerId(data.id)
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
      await fetchTenants()
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
    else if (data) {
      setCustomers(prev => prev.map(c => c.id === customer.id ? data as Customer : c))
      await fetchTenants()
    }
  }

  useEffect(() => {
    if (!authLoading && (!profile || !profile.is_super_admin)) navigate('/')
  }, [profile, authLoading, navigate])

  useEffect(() => {
    if (!profile?.is_super_admin) return
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
        .map((m: { profile: Profile }) => m.profile)
        .filter(Boolean)
      // 중복 제거 (같은 유저가 여러 조직에 pending일 수 있음)
      const seen = new Set<string>()
      setPendingAdmins(admins.filter(p => { if (seen.has(p.id)) return false; seen.add(p.id); return true }))
      setLoading(false)
    })
    fetchPendingMembers()
    fetchCustomers()
    fetchMemberCounts()
  }, [profile])

  // 드로어가 열릴 때 멤버 목록 로드
  useEffect(() => {
    if (selectedTenantId) fetchDrawerMembers(selectedTenantId)
  }, [selectedTenantId])

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
      if (selectedTenantId === deleteConfirm.tenant.id) setSelectedTenantId(null)
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

  async function handleModeChange(tenant: Tenant, newMode: TenantMode) {
    const fromMode = displayMode(tenant.settings?.tenant_mode)
    if (newMode === fromMode) return
    let unassignedCount: number | undefined
    if (fromMode === '비회원' && (newMode === '회원개별' || newMode === '회원공유')) {
      const { count } = await supabase.from('assignments')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenant.id).is('user_id', null)
      unassignedCount = count ?? 0
    }
    setPendingModeChange({ tenant, from: fromMode, to: newMode, unassignedCount })
  }

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId) ?? customers[0] ?? null

  const createTenant = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedCustomer) {
      setMessage('오류: 조직을 생성할 고객 계정을 먼저 선택해 주세요.')
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
        customer_id: selectedCustomer.id,
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
      setForm(EMPTY_ORG_FORM)
      setCreateSlots(['10-12', '13-14', '14-16', '16-18', '20-22'])
      setMessage('조직이 생성됐습니다.')
    }
    setSaving(false)
  }, [form, createSlots, selectedCustomer, tenants])

  const pendingCustomerIds = useMemo(() => {
    const set = new Set<string>()
    for (const t of tenants) if ((pendingCountsByTenant[t.id] ?? 0) > 0) set.add(t.customer_id)
    return set
  }, [tenants, pendingCountsByTenant])

  const customerTenants = useMemo(
    () => tenants.filter(t => t.customer_id === selectedCustomer?.id),
    [tenants, selectedCustomer]
  )
  const selectedTenant = tenants.find(t => t.id === selectedTenantId) ?? null

  function handleSelectCustomer(id: string) {
    setSelectedCustomerId(id)
    setSelectedTenantId(null)
  }

  if (authLoading || loading) {
    return <div className="min-h-screen flex items-center justify-center text-[var(--color-text-secondary)]">로딩 중...</div>
  }

  if (!profile?.is_super_admin) return null

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <div className="max-w-[1400px] mx-auto" style={{ padding: 'clamp(16px,3vw,30px) clamp(14px,4vw,26px) 90px' }}>

        {/* ── Topbar ── */}
        <div className="flex items-center gap-[14px] mb-[clamp(18px,3vw,26px)]">
          <h1 className="m-0 text-[clamp(22px,5vw,28px)] font-extrabold tracking-[-0.8px] flex items-center gap-[10px] whitespace-nowrap">
            <span className="w-[32px] h-[32px] rounded-[9px] flex-shrink-0 grid place-items-center" style={{ background: '#14171C', color: '#fff' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 17l2-9 4.5 5L12 6l2.5 7L19 8l2 9z"/><path d="M3 20.5h18"/></svg>
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

        <PlanLimitsPanel />

        <PendingApprovalsBanner
          pendingAdmins={pendingAdmins}
          pendingMembers={pendingMembers}
          selectedMemberIds={selectedMemberIds}
          approving={approving}
          onApproveAdmin={async id => {
            const { error } = await supabase
              .from('tenant_members')
              .update({ is_approved: true })
              .eq('user_id', id)
              .eq('is_approved', false)
            if (error) setMessage(`승인 오류: ${error.message}`)
            else {
              setPendingAdmins(prev => prev.filter(a => a.id !== id))
              await Promise.all([fetchPendingMembers(), fetchMemberCounts()])
            }
          }}
          onRejectAdmin={async p => {
            if (!confirm(`"${p.name}"의 가입을 거절할까요? (프로필이 삭제됩니다)`)) return
            const { error } = await supabase.from('profiles').delete().eq('id', p.id)
            if (error) setMessage(`거절 오류: ${error.message}`)
            else setPendingAdmins(prev => prev.filter(a => a.id !== p.id))
          }}
          onToggleMember={id => setSelectedMemberIds(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id); else next.add(id)
            return next
          })}
          onToggleAll={checked => setSelectedMemberIds(checked ? new Set(pendingMembers.map(m => m.id)) : new Set())}
          onApproveSelected={async () => {
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
              await Promise.all([fetchPendingMembers(), fetchMemberCounts()])
            }
            setApproving(false)
          }}
        />

        {/* ── Account Hub ── */}
        <div className="hub">
          <AccountRail
            customers={customers}
            tenants={tenants}
            selectedId={selectedCustomer?.id ?? ''}
            onSelect={handleSelectCustomer}
            pendingCustomerIds={pendingCustomerIds}
            isOpen={railOpen}
            onClose={() => setRailOpen(false)}
            showCreateCustomer={showCreateCustomer}
            setShowCreateCustomer={setShowCreateCustomer}
            customerForm={customerForm}
            setCustomerForm={setCustomerForm}
            customerSaving={customerSaving}
            onCreateCustomer={createCustomer}
          />

          {selectedCustomer ? (
            <HubMain
              customer={selectedCustomer}
              tenants={customerTenants}
              memberCounts={memberCounts}
              pendingCounts={pendingCountsByTenant}
              view={view}
              setView={setView}
              selectedOrgId={selectedTenantId}
              onSelectOrg={id => setSelectedTenantId(prev => prev === id ? null : id)}
              onOpenRail={() => setRailOpen(true)}
              ownerEmails={ownerEmails}
              phoneSaving={phoneSaving}
              ownerSaving={ownerSaving}
              savePhone={savePhone}
              saveOwner={saveOwner}
              updateCustomerPlan={updateCustomerPlan}
              toggleCustomerActive={toggleCustomerActive}
              startDeleteCustomer={startDeleteCustomer}
              restoreCustomer={restoreCustomer}
              restoringId={restoringId}
              onHardDelete={setHardDeleteConfirm}
              showCreate={showCreate}
              setShowCreate={setShowCreate}
              form={form}
              setForm={setForm}
              createSlots={createSlots}
              setCreateSlots={setCreateSlots}
              saving={saving}
              onCreateTenant={createTenant}
            />
          ) : (
            <div className="hub-main">
              <div className="hub-breadcrumb">
                <button
                  onClick={() => setRailOpen(true)}
                  className="hidden max-[1000px]:inline-flex items-center justify-center w-7 h-7 rounded-lg border border-[var(--color-border-strong)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] mr-1"
                  title="고객 목록"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
                </button>
                <span>계정 허브</span>
              </div>
              {customers.length === 0 ? (
                <div className="flex flex-col items-center gap-4 py-20 text-center">
                  <p className="text-sm text-[var(--color-text-muted)]">등록된 고객 계정이 없습니다.</p>
                  <button
                    onClick={() => { setShowCreateCustomer(true); setRailOpen(true) }}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-colors"
                    style={{ background: 'var(--color-brand-primary)' }}
                  >
                    + 새 고객 추가
                  </button>
                </div>
              ) : (
                <p className="text-center text-sm text-[var(--color-text-muted)] py-16">고객을 선택해 주세요.</p>
              )}
            </div>
          )}

          {selectedTenant && (
            <OrgDrawer
              tenant={selectedTenant}
              members={drawerMembers}
              membersLoading={drawerMembersLoading}
              onClose={() => setSelectedTenantId(null)}
              isOpen={true}
              editingNameId={editingNameId}
              editName={editName}
              setEditName={setEditName}
              nameSaving={nameSaving}
              setEditingNameId={setEditingNameId}
              saveName={saveName}
              editingSlugId={editingSlugId}
              editSlug={editSlug}
              setEditSlug={setEditSlug}
              slugSaving={slugSaving}
              setEditingSlugId={setEditingSlugId}
              saveSlug={saveSlug}
              modeSaving={modeSaving}
              onModeChange={handleModeChange}
              onOpenSchedule={t => { setTenant(t, 'admin'); navigate('/') }}
              onOpenAdmin={t => navigate(`/admin?org=${t.id}`)}
              deletingSaving={deletingSaving}
              onDelete={deleteTenant}
              onReactivate={reactivateTenant}
              onApproveMember={approveMember}
              onRejectMember={rejectMember}
              approvingMemberId={approvingMemberId}
            />
          )}
        </div>
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

      {/* Tenant delete confirmation modal */}
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
