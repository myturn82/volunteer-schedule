import { useState, useMemo, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

type HighlightRow = { id: string; date: string; time_slot: string }

export function useSlotHighlights(tenantId: string) {
  const [highlights, setHighlights] = useState<HighlightRow[]>([])
  const rangeRef = useRef<{ from: string; to: string } | null>(null)

  // Realtime 구독 — INSERT/DELETE 실시간 반영
  useEffect(() => {
    if (!tenantId) return
    const channel = supabase
      .channel(`slot_highlights-${tenantId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'slot_highlights',
        filter: `tenant_id=eq.${tenantId}`,
      }, payload => {
        const row = payload.new as HighlightRow
        if (!rangeRef.current || row.date < rangeRef.current.from || row.date > rangeRef.current.to) return
        setHighlights(prev =>
          prev.some(h => h.id === row.id) ? prev : [...prev, row]
        )
      })
      .on('postgres_changes', {
        event: 'DELETE', schema: 'public', table: 'slot_highlights',
        filter: `tenant_id=eq.${tenantId}`,
      }, payload => {
        // DEFAULT replica identity → payload.old 에는 PK(id)만 포함됨
        const { id } = payload.old as { id: string }
        setHighlights(prev => prev.filter(h => h.id !== id))
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
      .select('id, date, time_slot')
      .eq('tenant_id', tenantId)
      .gte('date', from)
      .lte('date', to)
    if (error) console.error('[slot_highlights] load error:', error)
    setHighlights(data ?? [])
  }

  async function toggleHighlight(date: string, timeSlot: string) {
    if (!tenantId) return
    const existing = highlights.find(h => h.date === date && h.time_slot === timeSlot)
    if (existing) {
      // 낙관적 업데이트 (id 기준)
      setHighlights(prev => prev.filter(h => h.id !== existing.id))
      await supabase
        .from('slot_highlights')
        .delete()
        .eq('id', existing.id)
    } else {
      const { data, error } = await supabase
        .from('slot_highlights')
        .insert({ tenant_id: tenantId, date, time_slot: timeSlot })
        .select('id, date, time_slot')
        .single()
      if (error) console.error('[slot_highlights] insert error:', error)
      if (data) setHighlights(prev =>
        prev.some(h => h.id === data.id) ? prev : [...prev, data]
      )
    }
  }

  // key 형식: "YYYY-MM-DD|timeSlot"
  const highlightSet = useMemo(
    () => new Set(highlights.map(h => `${h.date}|${h.time_slot}`)),
    [highlights]
  )

  return { highlightSet, loadHighlights, toggleHighlight }
}
