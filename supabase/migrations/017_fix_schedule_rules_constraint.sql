-- 017_fix_schedule_rules_constraint.sql
-- Replace single-tenant unique constraint with multi-tenant one.

ALTER TABLE schedule_rules
  DROP CONSTRAINT IF EXISTS schedule_rules_day_of_week_time_slot_key;

ALTER TABLE schedule_rules
  ADD CONSTRAINT IF NOT EXISTS schedule_rules_tenant_day_slot_unique
  UNIQUE (tenant_id, day_of_week, time_slot);
