-- 037_plan_limits.sql
-- Super-admin configurable per-plan limits (org count / member count).
-- null = unlimited.

create table if not exists plan_limits (
  plan       text primary key check (plan in ('basic', 'pro', 'business')),
  max_orgs   integer,
  max_users  integer,
  updated_at timestamptz not null default now()
);

insert into plan_limits (plan, max_orgs, max_users) values
  ('basic', 1, 20),
  ('pro', 5, 100),
  ('business', null, null)
on conflict (plan) do nothing;

alter table plan_limits enable row level security;

create policy "plan_limits_select_authenticated" on plan_limits
  for select using (auth.uid() is not null);

create policy "plan_limits_update_super_admin" on plan_limits
  for update using (is_super_admin()) with check (is_super_admin());
