-- 016_tenant_roles.sql
-- Custom roles per tenant with manager flag, and role_id on tenant_members.

create table if not exists tenant_roles (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  name          text not null,
  is_manager    boolean not null default false,
  display_order int not null default 0,
  created_at    timestamptz not null default now(),
  unique(tenant_id, name)
);

create index if not exists idx_tenant_roles_tenant on tenant_roles(tenant_id);

-- Nullable FK on tenant_members — ON DELETE SET NULL keeps member even if role is removed.
alter table tenant_members
  add column if not exists role_id uuid references tenant_roles(id) on delete set null;

-- RLS
alter table tenant_roles enable row level security;

create policy "tenant_roles_select_member" on tenant_roles
  for select using (is_tenant_member(tenant_id) or is_super_admin());

create policy "tenant_roles_admin_write" on tenant_roles
  for all
  using (is_tenant_admin(tenant_id) or is_super_admin())
  with check (is_tenant_admin(tenant_id) or is_super_admin());
