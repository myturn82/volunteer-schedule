-- 019_assignments_admin_insert.sql
-- Allow tenant admins and super admins to insert assignments on behalf of any member.
-- The existing assignments_insert_member policy only allows users to insert rows
-- where user_id = auth.uid(), which blocks admins from registering others.

CREATE POLICY "assignments_insert_admin" ON assignments
  FOR INSERT WITH CHECK (
    is_tenant_admin(tenant_id) OR is_super_admin()
  );
