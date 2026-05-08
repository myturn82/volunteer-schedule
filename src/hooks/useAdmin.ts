import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Profile, ScheduleRule, DateOverride, UserRole } from '../types'

interface AdminState {
  profiles: Profile[]
  scheduleRules: ScheduleRule[]
  dateOverrides: DateOverride[]
  loading: boolean
  updateRole: (id: string, role: UserRole) => Promise<string | null>
  toggleScheduleRule: (ruleId: string, currentIsOpen: boolean) => Promise<string | null>
  addDateOverride: (date: string, isOpen: boolean, isHoliday: boolean, label: string | null) => Promise<string | null>
  deleteDateOverride: (id: string) => Promise<string | null>
}

export function useAdmin(): AdminState {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [scheduleRules, setScheduleRules] = useState<ScheduleRule[]>([])
  const [dateOverrides, setDateOverrides] = useState<DateOverride[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadAll() {
      const [p, r, d] = await Promise.all([
        supabase.from('profiles').select('*').order('created_at'),
        supabase.from('schedule_rules').select('*').order('day_of_week').order('time_slot'),
        supabase.from('date_overrides').select('*').order('date'),
      ])
      setProfiles(p.data ?? [])
      setScheduleRules(r.data ?? [])
      setDateOverrides(d.data ?? [])
      setLoading(false)
    }
    loadAll()
  }, [])

  const updateRole = useCallback(async (id: string, role: UserRole): Promise<string | null> => {
    const { error } = await supabase.from('profiles').update({ role }).eq('id', id)
    if (!error) setProfiles(prev => prev.map(p => p.id === id ? { ...p, role } : p))
    return error?.message ?? null
  }, [])

  const toggleScheduleRule = useCallback(async (ruleId: string, currentIsOpen: boolean): Promise<string | null> => {
    const newIsOpen = !currentIsOpen
    const { error } = await supabase.from('schedule_rules').update({ is_open: newIsOpen }).eq('id', ruleId)
    if (!error) setScheduleRules(prev => prev.map(r => r.id === ruleId ? { ...r, is_open: newIsOpen } : r))
    return error?.message ?? null
  }, [])

  const addDateOverride = useCallback(async (date: string, isOpen: boolean, isHoliday: boolean, label: string | null): Promise<string | null> => {
    const { data, error } = await supabase
      .from('date_overrides')
      .upsert({ date, is_open: isOpen, is_holiday: isHoliday, label }, { onConflict: 'date' })
      .select()
      .single()
    if (!error && data) {
      setDateOverrides(prev => {
        const idx = prev.findIndex(d => d.date === date)
        if (idx >= 0) return prev.map((d, i) => i === idx ? data : d)
        return [...prev, data].sort((a, b) => a.date.localeCompare(b.date))
      })
    }
    return error?.message ?? null
  }, [])

  const deleteDateOverride = useCallback(async (id: string): Promise<string | null> => {
    const { error } = await supabase.from('date_overrides').delete().eq('id', id)
    if (!error) setDateOverrides(prev => prev.filter(d => d.id !== id))
    return error?.message ?? null
  }, [])

  return { profiles, scheduleRules, dateOverrides, loading, updateRole, toggleScheduleRule, addDateOverride, deleteDateOverride }
}
