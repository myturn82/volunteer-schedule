-- 011_tenant_seed_and_backfill.sql
-- Create the default tenant for all existing data and enroll current users.

-- 1) Create default tenant preserving current volunteer-schedule settings.
insert into tenants (slug, name, business_type, settings)
values (
  'default',
  '기본 단체',
  'volunteer',
  jsonb_build_object(
    'open_from',             '10:00',
    'open_to',               '22:00',
    'slot_interval_minutes', 120,
    'title',                 '자원봉사 스케줄',
    'theme_color',           '#2563eb',
    'timezone',              'Asia/Seoul',
    'locale',                'ko-KR'
  )
)
on conflict (slug) do nothing;

-- 2) Backfill tenant_id on all existing tenant-scoped rows.
update assignments
   set tenant_id = (select id from tenants where slug = 'default')
 where tenant_id is null;

update slot_settings
   set tenant_id = (select id from tenants where slug = 'default')
 where tenant_id is null;

update schedule_rules
   set tenant_id = (select id from tenants where slug = 'default')
 where tenant_id is null;

update date_overrides
   set tenant_id = (select id from tenants where slug = 'default')
 where tenant_id is null;

-- 3) Enroll all existing profiles as members of the default tenant.
--    Existing admins become tenant admins; everyone else becomes a member.
insert into tenant_members (tenant_id, user_id, role)
select
  (select id from tenants where slug = 'default'),
  p.id,
  case when p.role = 'admin' then 'admin' else 'member' end
from profiles p
on conflict (tenant_id, user_id) do nothing;
