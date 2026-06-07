-- 013_tenant_rls.sql
-- Replace all single-tenant RLS policies with tenant-scoped policies.
-- Uses security definer helper functions to avoid RLS recursion.

-- ─── Add is_super_admin column before helper functions reference it ──────────
alter table profiles
  add column if not exists is_super_admin boolean not null default false;

-- ─── Helper functions ────────────────────────────────────────────────────────

create or replace function public.is_tenant_member(t uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from tenant_members
    where tenant_id = t and user_id = auth.uid()
  );
$$;

create or replace function public.is_tenant_admin(t uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from tenant_members
    where tenant_id = t and user_id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.is_super_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select is_super_admin from profiles where id = auth.uid()),
    false
  );
$$;

-- ─── tenants ─────────────────────────────────────────────────────────────────

alter table tenants enable row level security;

drop policy if exists "tenants_select_member"   on tenants;
drop policy if exists "tenants_all_super_admin" on tenants;

create policy "tenants_select_member" on tenants
  for select using (is_tenant_member(id) or is_super_admin());

create policy "tenants_all_super_admin" on tenants
  for all using (is_super_admin()) with check (is_super_admin());

-- ─── tenant_members ───────────────────────────────────────────────────────────

alter table tenant_members enable row level security;

drop policy if exists "members_select_own_tenant" on tenant_members;
drop policy if exists "members_admin_manage"       on tenant_members;
drop policy if exists "members_super_admin_all"    on tenant_members;

create policy "members_select_own_tenant" on tenant_members
  for select using (is_tenant_member(tenant_id) or is_super_admin());

create policy "members_admin_manage" on tenant_members
  for all
  using (is_tenant_admin(tenant_id) or is_super_admin())
  with check (is_tenant_admin(tenant_id) or is_super_admin());

-- ─── assignments ─────────────────────────────────────────────────────────────

-- Drop legacy policies.
drop policy if exists "assignments_select_all"      on assignments;
drop policy if exists "assignments_insert_own"       on assignments;
drop policy if exists "assignments_update_own"       on assignments;
drop policy if exists "assignments_delete_own"       on assignments;
drop policy if exists "assignments_admin_all"        on assignments;
drop policy if exists "assignments_team_leader_all"  on assignments;

create policy "assignments_select_member" on assignments
  for select using (is_tenant_member(tenant_id) or is_super_admin());

create policy "assignments_insert_member" on assignments
  for insert with check (
    is_tenant_member(tenant_id) and auth.uid() = user_id
  );

create policy "assignments_update_own_or_admin" on assignments
  for update using (
    (is_tenant_member(tenant_id) and auth.uid() = user_id)
    or is_tenant_admin(tenant_id)
    or is_super_admin()
  );

create policy "assignments_delete_own_or_admin" on assignments
  for delete using (
    (is_tenant_member(tenant_id) and auth.uid() = user_id)
    or is_tenant_admin(tenant_id)
    or is_super_admin()
  );

-- ─── slot_settings ───────────────────────────────────────────────────────────

drop policy if exists "slot_settings_select_all"       on slot_settings;
drop policy if exists "slot_settings_admin_all"        on slot_settings;
drop policy if exists "slot_settings_team_leader_all"  on slot_settings;

create policy "slot_settings_select_member" on slot_settings
  for select using (is_tenant_member(tenant_id) or is_super_admin());

create policy "slot_settings_admin_write" on slot_settings
  for all
  using (is_tenant_admin(tenant_id) or is_super_admin())
  with check (is_tenant_admin(tenant_id) or is_super_admin());

-- ─── schedule_rules ──────────────────────────────────────────────────────────

drop policy if exists "schedule_rules_select_all"  on schedule_rules;
drop policy if exists "schedule_rules_admin_all"   on schedule_rules;

create policy "schedule_rules_select_member" on schedule_rules
  for select using (is_tenant_member(tenant_id) or is_super_admin());

create policy "schedule_rules_admin_write" on schedule_rules
  for all
  using (is_tenant_admin(tenant_id) or is_super_admin())
  with check (is_tenant_admin(tenant_id) or is_super_admin());

-- ─── date_overrides ──────────────────────────────────────────────────────────

drop policy if exists "date_overrides_select_all"  on date_overrides;
drop policy if exists "date_overrides_admin_all"   on date_overrides;

create policy "date_overrides_select_member" on date_overrides
  for select using (is_tenant_member(tenant_id) or is_super_admin());

create policy "date_overrides_admin_write" on date_overrides
  for all
  using (is_tenant_admin(tenant_id) or is_super_admin())
  with check (is_tenant_admin(tenant_id) or is_super_admin());

-- ─── profiles ────────────────────────────────────────────────────────────────
-- Members can see profiles of users in the same tenant (needed for assignment display).

drop policy if exists "profiles_select_all"              on profiles;
drop policy if exists "profiles_admin_update"            on profiles;
drop policy if exists "profiles_update_own"              on profiles;
drop policy if exists "profiles_select_self_or_comember" on profiles;

create policy "profiles_select_self_or_comember" on profiles
  for select using (
    auth.uid() = id
    or is_super_admin()
    or exists (
      select 1 from tenant_members tm1
      join tenant_members tm2 on tm1.tenant_id = tm2.tenant_id
      where tm1.user_id = auth.uid() and tm2.user_id = profiles.id
    )
  );

create policy "profiles_update_own" on profiles
  for update using (auth.uid() = id);

create policy "profiles_admin_update" on profiles
  for update using (is_super_admin());
