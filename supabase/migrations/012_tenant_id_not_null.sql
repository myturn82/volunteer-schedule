-- 012_tenant_id_not_null.sql
-- Promote tenant_id to NOT NULL now that backfill is complete.
-- Also replace hardcoded time_slot enum CHECKs with a format-only check,
-- and tighten uniqueness constraints to be per-tenant.

-- Safety guard: abort if any rows still lack a tenant_id.
do $$
begin
  if exists (select 1 from assignments    where tenant_id is null) or
     exists (select 1 from slot_settings  where tenant_id is null) or
     exists (select 1 from schedule_rules where tenant_id is null) or
     exists (select 1 from date_overrides where tenant_id is null)
  then
    raise exception 'Backfill incomplete: tenant_id is NULL on some rows. Run 011 first.';
  end if;
end$$;

-- Replace hardcoded time_slot CHECK constraints with a loose format check
-- so dynamic slot strings (e.g. '09-10', '09:00-10:00') are accepted.
alter table assignments    drop constraint if exists assignments_time_slot_check;
alter table slot_settings  drop constraint if exists slot_settings_time_slot_check;
alter table schedule_rules drop constraint if exists schedule_rules_time_slot_check;

alter table assignments    add constraint assignments_time_slot_format
  check (time_slot ~ '^[0-9]{1,2}-[0-9]{1,2}$');
alter table slot_settings  add constraint slot_settings_time_slot_format
  check (time_slot ~ '^[0-9]{1,2}-[0-9]{1,2}$');
alter table schedule_rules add constraint schedule_rules_time_slot_format
  check (time_slot ~ '^[0-9]{1,2}-[0-9]{1,2}$');

-- Promote tenant_id to NOT NULL.
alter table assignments    alter column tenant_id set not null;
alter table slot_settings  alter column tenant_id set not null;
alter table schedule_rules alter column tenant_id set not null;
alter table date_overrides alter column tenant_id set not null;

-- Replace global unique constraints with per-tenant equivalents.
alter table slot_settings  drop constraint if exists slot_settings_time_slot_key;
alter table schedule_rules drop constraint if exists schedule_rules_day_of_week_time_slot_key;
alter table date_overrides drop constraint if exists date_overrides_date_key;

create unique index if not exists slot_settings_tenant_slot_uniq
  on slot_settings(tenant_id, time_slot);

create unique index if not exists schedule_rules_tenant_dow_slot_uniq
  on schedule_rules(tenant_id, day_of_week, time_slot);

create unique index if not exists date_overrides_tenant_date_uniq
  on date_overrides(tenant_id, date);

-- Replace the 009 assignment unique index to include tenant_id.
drop index if exists unique_volunteer_assignment;
create unique index if not exists unique_volunteer_assignment
  on assignments(tenant_id, year, month, day, time_slot, volunteer_name)
  where volunteer_type != 'admin_note';
