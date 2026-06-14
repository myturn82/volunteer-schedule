-- 051_date_overrides_realtime.sql
-- date_overrides 실시간 구독 활성화 (잠금·휴관 즉시 반영)

-- DELETE payload.old에 모든 컬럼 포함 → tenant_id 필터 적용 가능
ALTER TABLE date_overrides REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE date_overrides;
