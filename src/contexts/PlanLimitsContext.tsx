import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { PLAN_LIMITS } from '../types'
import type { PlanType, PlanLimits, PlanLimitsMap } from '../types'

interface PlanLimitsState {
  planLimits: PlanLimitsMap
  loading: boolean
  refreshPlanLimits: () => Promise<void>
  updatePlanLimit: (plan: PlanType, limits: PlanLimits) => Promise<string | null>
}

const PlanLimitsContext = createContext<PlanLimitsState | null>(null)

export function PlanLimitsProvider({ children }: { children: React.ReactNode }) {
  const [planLimits, setPlanLimits] = useState<PlanLimitsMap>(PLAN_LIMITS)
  const [loading, setLoading] = useState(true)

  const refreshPlanLimits = useCallback(async () => {
    const { data, error } = await supabase.from('plan_limits').select('*')
    if (!error && data && data.length > 0) {
      setPlanLimits(prev => {
        const next = { ...prev }
        for (const row of data) {
          next[row.plan as PlanType] = {
            maxOrgs: row.max_orgs ?? Infinity,
            maxUsers: row.max_users ?? Infinity,
          }
        }
        return next
      })
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    refreshPlanLimits()
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      refreshPlanLimits()
    })
    return () => subscription.unsubscribe()
  }, [refreshPlanLimits])

  const updatePlanLimit = useCallback(async (plan: PlanType, limits: PlanLimits): Promise<string | null> => {
    const { error } = await supabase
      .from('plan_limits')
      .update({
        max_orgs: limits.maxOrgs === Infinity ? null : limits.maxOrgs,
        max_users: limits.maxUsers === Infinity ? null : limits.maxUsers,
        updated_at: new Date().toISOString(),
      })
      .eq('plan', plan)
    if (error) return error.message
    setPlanLimits(prev => ({ ...prev, [plan]: limits }))
    return null
  }, [])

  return (
    <PlanLimitsContext.Provider value={{ planLimits, loading, refreshPlanLimits, updatePlanLimit }}>
      {children}
    </PlanLimitsContext.Provider>
  )
}

export function usePlanLimits(): PlanLimitsState {
  const ctx = useContext(PlanLimitsContext)
  if (!ctx) throw new Error('usePlanLimits must be used within PlanLimitsProvider')
  return ctx
}
