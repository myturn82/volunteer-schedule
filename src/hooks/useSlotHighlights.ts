import { useState, useMemo, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

export function useSlotHighlights(tenantId: string) {
  const [highlights, setHighlights] = useState<{ date: string; time_slot: string }[]>([])
  const rangeRef = useRef<{ from: string; to: string } | null>(null)

  // Realtime subscription — INSERT/DELETE 실시간 반영
  useEffect(() => {
    if (!tenantId) return
    const channel = supabase
      .channel(`slot_highlights-${tenantId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'slot_highlights',
        filter: `tenant_id=eq.${tenantId}`,
      }, payload => {
        const row = payload.new as { date: string; time_slot: string }
        if (!rangeRef.current || row.date < rangeRef.current.from || row.date > rangeRef.current.to) return
        setHighlights(prev =>
          prev.some(h => h.date === row.date && h.time_slot === row.time_slot)
            ? prev
            : [...prev, { date: row.date, time_slot: row.time_slot }]
        )
      })
      .on('postgres_changes', {
        event: 'DELETE', schema: 'public', table: 'slot_highlights',
        filter: `tenant_id=eq.${tenantId}`,
      }, payload => {
        const row = payload.old as { date: string; time_slot: string }
        setHighlights(prev => prev.filter(h => !(h.date === row.date && h.time_slot === row.time_slot)))
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [tenantId])

  async function loadHighlights(year: number, month: number) {
    if (!tenantId) return
    const pad = (n: number) => String(n).padStart(2, '0')
    const from = `${year}-${pad(month)}-01`
    const to   = `${year}-${pad(month)}-${new Date(year, month, 0).getDate()}`
    rangeRef.current = { from, to }
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
      setHighlights(prev => prev.filter(h => !(h.date === date && h.time_slot === timeSlot)))
      await supabase
        .from('slot_highlights')
        .delete()
        .eq('tenant_id', tenantId)
        .eq('date', date)
        .eq('time_slot', timeSlot)
    } else {
      const { data, error } = await supabase
        .from('slot_highlights')
        .insert({ tenant_id: tenantId, date, time_slot: timeSlot })
        .select('date, time_slot')
        .single()
      if (error) console.error('[slot_highlights] insert error:', error)
      if (data) setHighlights(prev =>
        prev.some(h => h.date === data.date && h.time_slot === data.time_slot)
          ? prev
          : [...prev, data]
      )
    }
  }

  const highlightSet = useMemo(
    () => new Set(highlights.map(h => `${h.date}|${h.time_slot}`)),
    [highlights]
  )

  return { highlightSet, loadHighlights, toggleHighlight }
}
