-- 052_assignment_snapshot_highlights.sql
-- 스케줄 초기화 시 함께 삭제된 빈 슬롯 알림(slot_highlights)을 스냅샷에 보관하여
-- "복구" 시 다시 복원할 수 있도록 함

ALTER TABLE assignment_snapshots
  ADD COLUMN IF NOT EXISTS highlights_data JSONB NOT NULL DEFAULT '[]'::jsonb;
