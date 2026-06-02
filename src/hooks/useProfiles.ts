import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useTenant } from '../contexts/TenantContext'
import type { Profile } from '../types'
import type { MemberPreference } from '../utils/autoAssign'

export type ProfileWithRole = Profile & { tenantRoleId: string | null }

export function useProfiles() {
  const { tenant } = useTenant()
  const [profiles, setProfiles] = useState<ProfileWithRole[]>([])
  const [memberPreferences, setMemberPreferences] = useState<Map<string, MemberPreference>>(new Map())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!tenant) return
    supabase
      .from('tenant_members')
      .select('user_id, role_id, available_days, monthly_limit, profiles(*)')
      .eq('tenant_id', tenant.id)
      .then(({ data }) => {
        const rows = (data ?? []) as unknown as {
          user_id: string
          role_id: string | null
          available_days: number[] | null
          monthly_limit: number | null
          profiles: Profile | null
        }[]

        const list = rows
          .map(m => m.profiles ? { ...m.profiles, tenantRoleId: m.role_id ?? null } : null)
          .filter(Boolean) as ProfileWithRole[]
        list.sort((a, b) => a.name.localeCompare(b.name, 'ko'))
        setProfiles(list)

        const prefMap = new Map<string, MemberPreference>()
        rows.forEach(m => {
          prefMap.set(m.user_id, {
            availableDays: m.available_days,
            monthlyLimit: m.monthly_limit,
          })
        })
        setMemberPreferences(prefMap)

        setLoading(false)
      })
  }, [tenant?.id])

  return { profiles, memberPreferences, loading }
}
