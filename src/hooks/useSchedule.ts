import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Assignment, SlotSetting, ScheduleRule, DateOverride, TimeSlot, VolunteerType } from '../types'

interface ScheduleData {
  assignments: Assignment[]
  slotSettings: SlotSetting[]
  scheduleRules: ScheduleRule[]
  dateOverrides: DateOverride[]
  loading: boolean
  addAssignment: (params: AddParams) => Promise<string | null>
  updateAssignment: (id: string, params: UpdateParams) => Promise<string | null>
  deleteAssignment: (id: string) => Promise<string | null>
  updateSlotCapacity: (timeSlot: TimeSlot, maxCapacity: number) => Promise<string | null>
}

interface AddParams {
  year: number
  month: number
  day: number
  time_slot: TimeSlot
  volunteer_name: string
  note?: string
  volunteer_type: string
  time_sub?: string
  color?: string
  user_id: string
}

interface UpdateParams {
  volunteer_name?: string
  note?: string
  volunteer_type?: VolunteerType
  time_sub?: string
  color?: string
}

export function useSchedule(year: number, month: number): ScheduleData {
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [slotSettings, setSlotSettings] = useState<SlotSetting[]>([])
  const [scheduleRules, setScheduleRules] = useState<ScheduleRule[]>([])
  const [dateOverrides, setDateOverrides] = useState<DateOverride[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      supabase.from('assignments').select('*').eq('year', year).eq('month', month),
      supabase.from('slot_settings').select('*'),
      supabase.from('schedule_rules').select('*'),
      supabase.from('date_overrides').select('*')
        .gte('date', `${year}-${String(month).padStart(2, '0')}-01`)
        .lte('date', `${year}-${String(month).padStart(2, '0')}-31`),
    ]).then(([a, ss, sr, dov]) => {
      if (a.data) setAssignments(a.data)
      if (ss.data) setSlotSettings(ss.data)
      if (sr.data) setScheduleRules(sr.data)
      if (dov.data) setDateOverrides(dov.data)
      setLoading(false)
    })

    // Realtime: 다른 사용자 변경사항 실시간 반영
    const channel = supabase
      .channel(`assignments-${year}-${month}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'assignments', filter: `year=eq.${year}` },
        payload => setAssignments(prev => {
          const incoming = payload.new as Assignment
          if (incoming.month !== month) return prev
          return prev.some(a => a.id === incoming.id) ? prev : [...prev, incoming]
        })
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'assignments', filter: `year=eq.${year}` },
        payload => {
          const updated = payload.new as Assignment
          if (updated.month === month) {
            setAssignments(prev => prev.map(a => a.id === updated.id ? updated : a))
          }
        }
      )
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'assignments' },
        payload => setAssignments(prev => prev.filter(a => a.id !== payload.old.id))
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [year, month])

  const addAssignment = useCallback(async (params: AddParams): Promise<string | null> => {
    const { error } = await supabase.from('assignments').insert(params)
    return error?.message ?? null
  }, [])

  const updateAssignment = useCallback(async (id: string, params: UpdateParams): Promise<string | null> => {
    const { error } = await supabase.from('assignments').update(params).eq('id', id)
    if (error) return error.message
    setAssignments(prev => prev.map(a => a.id === id ? { ...a, ...params } : a))
    return null
  }, [])

  const deleteAssignment = useCallback(async (id: string): Promise<string | null> => {
    const { error } = await supabase.from('assignments').delete().eq('id', id)
    if (error) return error.message
    setAssignments(prev => prev.filter(a => a.id !== id))
    return null
  }, [])

  const updateSlotCapacity = useCallback(async (timeSlot: TimeSlot, maxCapacity: number): Promise<string | null> => {
    const { error } = await supabase
      .from('slot_settings')
      .upsert({ time_slot: timeSlot, max_capacity: maxCapacity }, { onConflict: 'time_slot' })
    if (error) return error.message
    const { data } = await supabase.from('slot_settings').select('*')
    if (data) setSlotSettings(data)
    return null
  }, [])

  return { assignments, slotSettings, scheduleRules, dateOverrides, loading, addAssignment, updateAssignment, deleteAssignment, updateSlotCapacity }
}
