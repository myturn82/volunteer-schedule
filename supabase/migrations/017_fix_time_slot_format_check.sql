-- 017_fix_time_slot_format_check.sql
-- Allow decimal time slot values (e.g. '10.5-11', '10-10.5') for 30-min intervals.
-- The per-tenant unique index on schedule_rules already exists from migration 012.

ALTER TABLE assignments
  DROP CONSTRAINT IF EXISTS assignments_time_slot_format;
ALTER TABLE assignments
  ADD CONSTRAINT assignments_time_slot_format
  CHECK (time_slot ~ '^[0-9]{1,2}(\.[0-9]+)?-[0-9]{1,2}(\.[0-9]+)?$');

ALTER TABLE slot_settings
  DROP CONSTRAINT IF EXISTS slot_settings_time_slot_format;
ALTER TABLE slot_settings
  ADD CONSTRAINT slot_settings_time_slot_format
  CHECK (time_slot ~ '^[0-9]{1,2}(\.[0-9]+)?-[0-9]{1,2}(\.[0-9]+)?$');

ALTER TABLE schedule_rules
  DROP CONSTRAINT IF EXISTS schedule_rules_time_slot_format;
ALTER TABLE schedule_rules
  ADD CONSTRAINT schedule_rules_time_slot_format
  CHECK (time_slot ~ '^[0-9]{1,2}(\.[0-9]+)?-[0-9]{1,2}(\.[0-9]+)?$');
