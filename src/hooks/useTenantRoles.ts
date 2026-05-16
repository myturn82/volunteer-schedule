import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { TenantRole } from '../types'

interface TenantRolesState {
  roles: TenantRole[]
  loading: boolean
  addRole: (name: string, splitCell?: boolean, requiresCustomerInfo?: boolean) => Promise<string | null>
  deleteRole: (id: string) => Promise<string | null>
  updateRole: (id: string, fields: Partial<Pick<TenantRole, 'name' | 'display_order' | 'split_cell' | 'requires_customer_info'>>) => Promise<string | null>
}

export function useTenantRoles(tenantId: string): TenantRolesState {
  const [roles, setRoles] = useState<TenantRole[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!tenantId) return
    supabase
      .from('tenant_roles')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('display_order')
      .order('name')
      .then(({ data }) => {
        setRoles(data ?? [])
        setLoading(false)
      })
  }, [tenantId])

  const addRole = useCallback(async (name: string, splitCell = false, requiresCustomerInfo = false): Promise<string | null> => {
    const maxOrder = roles.reduce((m, r) => Math.max(m, r.display_order), -1)
    const { data, error } = await supabase
      .from('tenant_roles')
      .insert({ tenant_id: tenantId, name, split_cell: splitCell, requires_customer_info: requiresCustomerInfo, display_order: maxOrder + 1 })
      .select()
      .single()
    if (!error && data) setRoles(prev => [...prev, data])
    if (error?.code === '23505') return '같은 이름의 역할이 이미 존재합니다.'
    return error?.message ?? null
  }, [tenantId, roles])

  const deleteRole = useCallback(async (id: string): Promise<string | null> => {
    const { error } = await supabase.from('tenant_roles').delete().eq('id', id)
    if (!error) setRoles(prev => prev.filter(r => r.id !== id))
    return error?.message ?? null
  }, [])

  const updateRole = useCallback(async (id: string, fields: Partial<Pick<TenantRole, 'name' | 'display_order' | 'split_cell' | 'requires_customer_info'>>): Promise<string | null> => {
    const { error } = await supabase.from('tenant_roles').update(fields).eq('id', id)
    if (!error) setRoles(prev => prev.map(r => r.id === id ? { ...r, ...fields } : r))
    return error?.message ?? null
  }, [])

  return { roles, loading, addRole, deleteRole, updateRole }
}
