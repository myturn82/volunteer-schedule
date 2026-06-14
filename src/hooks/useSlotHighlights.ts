import { useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'

export function useSlotHighlights(tenantId: string) {
  const [highlights, setHighlights] = useState<{ date: string; time_slot: string }[]>([])

  async function loadHighlights(year: number, month: number) {
    if (!tenantId) return
    const pad = (n: number) => String(n).padStart(2, '0')
    const from = `${year}-${pad(month)}-01`
    const to   = `${year}-${pad(month)}-${new Date(year, month, 0).getDate()}`
    const { data, error } = await supabase
      .from('slot_highlights')
      .select('date, time_slot')
      .eq('tenant_id', tenantId)
      .gte('date', from)
      .lte('date', to)
    if (error) console.error('[slot_highlights] load error:', error)
    setHighlights(data ?? [])
  }

  async function toggleHighlight(date: string, timeSlot: string) {
    if (!tenantId) return
    const exists = highlights.some(h => h.date === date && h.time_slot === timeSlot)
    if (exists) {
      await supabase
        .from('slot_highlights')
        .delete()
        .eq('tenant_id', tenantId)
        .eq('date', date)
        .eq('time_slot', timeSlot)
      setHighlights(prev => prev.filter(h => !(h.date === date && h.time_slot === timeSlot)))
    } else {
      const { data, error } = await supabase
        .from('slot_highlights')
        .insert({ tenant_id: tenantId, date, time_slot: timeSlot })
        .select('date, time_slot')
        .single()
      if (error) console.error('[slot_highlights] insert error:', error)
      if (data) setHighlights(prev => [...prev, data])
    }
  }

  // key 형식: "YYYY-MM-DD|timeSlot"
  const highlightSet = useMemo(
    () => new Set(highlights.map(h => `${h.date}|${h.time_slot}`)),
    [highlights]
  )

  return { highlightSet, loadHighlights, toggleHighlight }
}
