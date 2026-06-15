import { supabase } from '../lib/supabase'
import type { Assignment } from '../types'
import type { HighlightSnapshotRow } from './useSlotHighlights'

export type SnapshotScope = 'month' | 'week' | 'day'

export interface SnapshotInfo {
  id: string
  year: number
  month: number
  scope: SnapshotScope
  days: number[] | null
  deletedCount: number
}

export function useAssignmentSnapshot(tenantId: string) {
  const saveSnapshot = async (
    toDelete: Assignment[],
    params: { year: number; month: number; scope: SnapshotScope; days?: number[]; highlights?: HighlightSnapshotRow[] }
  ): Promise<{ snapshotId: string | null; error: string | null }> => {
    if (!tenantId || !toDelete.length) return { snapshotId: null, error: null }

    // 같은 달 기존 스냅샷 삭제 (월별 1개 유지)
    await supabase
      .from('assignment_snapshots')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('year', params.year)
      .eq('month', params.month)

    const { data, error } = await supabase
      .from('assignment_snapshots')
      .insert({
        tenant_id: tenantId,
        year: params.year,
        month: params.month,
        scope: params.scope,
        days: params.days ?? null,
        snapshot_data: toDelete,
        deleted_count: toDelete.length,
        highlights_data: params.highlights ?? [],
      })
      .select('id')
      .single()

    if (error) return { snapshotId: null, error: error.message }
    return { snapshotId: data.id, error: null }
  }

  const restoreSnapshot = async (
    snapshotId: string
  ): Promise<{ restoredCount: number; highlights: HighlightSnapshotRow[]; error: string | null }> => {
    const { data: snap, error: fetchErr } = await supabase
      .from('assignment_snapshots')
      .select('*')
      .eq('id', snapshotId)
      .single()

    if (fetchErr || !snap) {
      return { restoredCount: 0, highlights: [], error: fetchErr?.message ?? '스냅샷을 찾을 수 없습니다' }
    }

    const rows = snap.snapshot_data as Assignment[]
    const highlights = (snap.highlights_data ?? []) as HighlightSnapshotRow[]
    const { year, month, scope, days } = snap as {
      year: number; month: number; scope: SnapshotScope; days: number[] | null
    }

    // 주 뷰처럼 인접 월 포함 여부 판단
    const extraMonthKeys = new Set(
      rows
        .filter(r => !(r.year === year && r.month === month))
        .map(r => `${r.year}-${r.month}`)
    )

    // 현재 스코프의 미잠금 배정 삭제 (primary month)
    let delQuery = supabase
      .from('assignments')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('year', year)
      .eq('month', month)
      .eq('is_locked', false)
    if (scope !== 'month' && days?.length) {
      delQuery = delQuery.in('day', days)
    }
    const { error: delErr } = await delQuery
    if (delErr) return { restoredCount: 0, highlights: [], error: delErr.message }

    // 인접 월 삭제 (주 뷰에서 월 경계를 넘는 경우)
    for (const ym of extraMonthKeys) {
      const [ey, em] = ym.split('-').map(Number)
      const extraDays = rows.filter(r => r.year === ey && r.month === em).map(r => r.day)
      const { error: adjErr } = await supabase
        .from('assignments')
        .delete()
        .eq('tenant_id', tenantId)
        .eq('year', ey)
        .eq('month', em)
        .eq('is_locked', false)
        .in('day', extraDays)
      if (adjErr) return { restoredCount: 0, highlights: [], error: adjErr.message }
    }

    // 스냅샷 데이터 재삽입 (id·created_at 제외하고 새 레코드로)
    const toInsert = rows.map(({ id: _id, created_at: _ca, ...rest }) => ({
      ...rest,
      tenant_id: tenantId,
    }))
    const { error: insErr } = await supabase.from('assignments').insert(toInsert)
    if (insErr) return { restoredCount: 0, highlights: [], error: insErr.message }

    // 복구 완료 후 스냅샷 삭제
    await supabase.from('assignment_snapshots').delete().eq('id', snapshotId)

    return { restoredCount: rows.length, highlights, error: null }
  }

  return { saveSnapshot, restoreSnapshot }
}
