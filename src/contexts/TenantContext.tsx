import { createContext, useContext, useState, useEffect, useMemo, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import type { Tenant, TenantMember, TenantAccessRole, LegendItem, CustomFieldDef, CustomFieldOption } from '../types'
import { generateTimeSlots, DEFAULT_TIME_SLOTS } from '../utils/timeSlots'

interface MembershipWithTenant extends TenantMember {
  tenant: Tenant
  tenant_role: { name: string } | null
}

interface TenantContextValue {
  tenant: Tenant | null
  tenantRole: TenantAccessRole | null
  memberships: MembershipWithTenant[]
  loading: boolean
  tenantSelectedByUser: boolean
  timeSlots: string[]
  slotLabels: Record<string, string>
  legendItems: LegendItem[]
  customFields: CustomFieldDef[]
  typeLabels: { member: string; '50plus': string }
  alreadyMemberNotice: string | null
  setTenant: (tenant: Tenant, role: TenantAccessRole) => void
  resetTenantSelection: () => void
  reloadMemberships: () => Promise<void>
  updateCurrentTenant: (tenant: Tenant) => void
  clearAlreadyMemberNotice: () => void
}

const TenantContext = createContext<TenantContextValue | null>(null)

export function TenantProvider({ children }: { children: ReactNode }) {
  const [tenant, setTenantState] = useState<Tenant | null>(null)
  const [tenantRole, setTenantRole] = useState<TenantAccessRole | null>(null)
  const [memberships, setMemberships] = useState<MembershipWithTenant[]>([])
  const [loading, setLoading] = useState(true)
  const [tenantSelectedByUser, setTenantSelectedByUser] = useState(false)
  const [alreadyMemberNotice, setAlreadyMemberNotice] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) fetchMemberships(session.user.id)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        fetchMemberships(session.user.id)
      } else {
        setMemberships([])
        setTenantState(null)
        setTenantRole(null)
        setTenantSelectedByUser(false)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchMemberships(userId: string) {
    const { data } = await supabase
      .from('tenant_members')
      .select('*, tenant:tenants(*), tenant_role:tenant_roles(name)')
      .eq('user_id', userId)

    const list = (data ?? []) as MembershipWithTenant[]

    // 소셜 가입 후 복귀 시 pending 조직/역할 처리
    // 동시에 두 번 호출될 수 있으므로 키를 즉시(동기적으로) 제거해 경쟁 조건 방지
    const pendingRaw = localStorage.getItem('vs_pending_social')
    if (pendingRaw) localStorage.removeItem('vs_pending_social')
    if (pendingRaw) {
      try {
        const { tenantId, tenantRoleId } = JSON.parse(pendingRaw)
        const alreadyMember = list.some(m => m.tenant_id === tenantId && m.is_approved !== false)
        if (!alreadyMember && tenantId) {
          await supabase.from('tenant_members').insert({
            tenant_id: tenantId,
            user_id: userId,
            role: 'member',
            role_id: tenantRoleId ?? null,
          })
          localStorage.setItem('vs_notice_join_requested', '가입 신청이 완료됐습니다. 관리자 승인 후 이용할 수 있습니다.')
          // 재조회
          const { data: data2 } = await supabase
            .from('tenant_members')
            .select('*, tenant:tenants(*), tenant_role:tenant_roles(name)')
            .eq('user_id', userId)
          const list2 = (data2 ?? []) as MembershipWithTenant[]
          const approved2 = list2.filter(m => m.is_approved !== false && m.tenant?.is_active !== false)
          setMemberships(approved2)
          if (approved2.length === 1) { setTenantState(approved2[0].tenant); setTenantRole(approved2[0].role) }
          setLoading(false)
          return
        }
        if (alreadyMember) {
          localStorage.setItem('vs_notice_already_member', '이미 가입된 조직입니다.')
        }
      } catch { /* invalid JSON */ }
    }

    // 승인된 멤버십만 사용 (is_approved가 없으면 true로 간주 — 마이그레이션 전 호환)
    // 비활성 조직(is_active=false)은 제외
    const approved = list.filter(m => m.is_approved !== false && m.tenant?.is_active !== false)
    setMemberships(approved)

    if (approved.length === 1) {
      setTenantState(approved[0].tenant)
      setTenantRole(approved[0].role)
    }

    setLoading(false)
  }

  function setTenant(t: Tenant, role: TenantAccessRole) {
    setTenantState(t)
    setTenantRole(role)
    setTenantSelectedByUser(true)
  }

  function resetTenantSelection() {
    setTenantState(null)
    setTenantRole(null)
    setTenantSelectedByUser(false)
  }

  async function reloadMemberships() {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) {
      setTenantState(null)
      setTenantRole(null)
      setTenantSelectedByUser(false)
      await fetchMemberships(session.user.id)
    }
  }

  function clearAlreadyMemberNotice() {
    setAlreadyMemberNotice(null)
  }

  function updateCurrentTenant(updated: Tenant) {
    setTenantState(prev => prev?.id === updated.id ? updated : prev)
    setMemberships(prev => prev.map(m => m.tenant.id === updated.id ? { ...m, tenant: updated } : m))
  }

  const timeSlots = useMemo(() => {
    if (!tenant) return DEFAULT_TIME_SLOTS
    const s = tenant.settings
    if (s.time_slots?.length) return s.time_slots
    return generateTimeSlots(s.open_from, s.open_to, s.slot_interval_minutes)
  }, [tenant])

  const slotLabels = useMemo<Record<string, string>>(
    () => tenant?.settings?.slot_labels ?? {},
    [tenant]
  )

  const legendItems = useMemo<LegendItem[]>(
    () => tenant?.settings?.legend_items ?? [],
    [tenant]
  )

  const customFields = useMemo<CustomFieldDef[]>(
    () => (tenant?.settings?.custom_fields ?? []).map(f => ({
      ...f,
      options: f.options?.map((opt): CustomFieldOption =>
        typeof opt === 'string' ? { name: opt, value: opt } : opt
      ),
    })),
    [tenant]
  )

  const typeLabels = useMemo(() => ({
    member: tenant?.settings?.volunteer_label ?? '팀원',
    '50plus': tenant?.settings?.plus_label ?? '50플러스활동가',
  }), [tenant])

  return (
    <TenantContext.Provider value={{
      tenant,
      tenantRole,
      memberships,
      loading,
      tenantSelectedByUser,
      timeSlots,
      slotLabels,
      legendItems,
      customFields,
      typeLabels,
      alreadyMemberNotice,
      clearAlreadyMemberNotice,
      setTenant,
      resetTenantSelection,
      reloadMemberships,
      updateCurrentTenant,
    }}>
      {children}
    </TenantContext.Provider>
  )
}

export function useTenant(): TenantContextValue {
  const ctx = useContext(TenantContext)
  if (!ctx) throw new Error('useTenant must be used within TenantProvider')
  return ctx
}
