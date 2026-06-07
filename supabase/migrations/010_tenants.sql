-- 010_tenants.sql
-- Multi-tenant foundation: tenants + tenant_members + nullable tenant_id FKs.

create table if not exists tenants (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique
                check (slug ~ '^[a-z0-9]([a-z0-9-]{0,38}[a-z0-9])?$'),
  name          text not null,
  business_type text,
  settings      jsonb not null default '{}'::jsonb,
  -- Expected keys in settings:
  --   open_from             text  'HH:MM'  (e.g. '10:00')
  --   open_to               text  'HH:MM'  (e.g. '22:00')
  --   slot_interval_minutes int            (e.g. 120)
  --   title                 text
  --   theme_color           text  '#RRGGBB'
  --   timezone              text  IANA tz  (e.g. 'Asia/Seoul')
  --   locale                text           (e.g. 'ko-KR')
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists tenant_members (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  user_id     uuid not null references profiles(id) on delete cascade,
  role        text not null default 'member'
              check (role in ('admin', 'member')),
  created_at  timestamptz not null default now(),
  unique (tenant_id, user_id)
);

create index if not exists idx_tenant_members_user   on tenant_members(user_id);
create index if not exists idx_tenant_members_tenant on tenant_members(tenant_id);

-- Add tenant_id (NULLABLE initially; backfill in 011, lock down in 012).
alter table assignments    add column if not exists tenant_id uuid references tenants(id) on delete cascade;
alter table slot_settings  add column if not exists tenant_id uuid references tenants(id) on delete cascade;
alter table schedule_rules add column if not exists tenant_id uuid references tenants(id) on delete cascade;
alter table date_overrides add column if not exists tenant_id uuid references tenants(id) on delete cascade;

-- Composite indexes for common query patterns.
create index if not exists idx_assignments_tenant     on assignments(tenant_id);
create index if not exists idx_slot_settings_tenant   on slot_settings(tenant_id);
create index if not exists idx_schedule_rules_tenant  on schedule_rules(tenant_id);
create index if not exists idx_date_overrides_tenant  on date_overrides(tenant_id);
create index if not exists idx_assignments_tenant_ym  on assignments(tenant_id, year, month);
create index if not exists idx_date_overrides_tenant_date on date_overrides(tenant_id, date);
