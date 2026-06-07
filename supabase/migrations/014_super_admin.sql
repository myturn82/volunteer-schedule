-- 014_super_admin.sql
-- is_super_admin column was moved to 013_tenant_rls.sql so the
-- is_super_admin() helper function can reference it immediately.
-- This migration is a no-op kept for numbering continuity.
--
-- To designate the first super admin, run in the Supabase SQL editor:
--   update profiles set is_super_admin = true where email = 'your@email.com';
select 1;
