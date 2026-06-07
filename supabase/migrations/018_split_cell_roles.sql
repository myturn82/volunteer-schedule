-- 018_split_cell_roles.sql
-- Add split_cell and requires_customer_info flags to tenant_roles.
-- Add role_id, customer_name, customer_phone to assignments.

ALTER TABLE tenant_roles
  ADD COLUMN IF NOT EXISTS split_cell              boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS requires_customer_info  boolean NOT NULL DEFAULT false;

ALTER TABLE assignments
  ADD COLUMN IF NOT EXISTS role_id        uuid REFERENCES tenant_roles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS customer_name  text,
  ADD COLUMN IF NOT EXISTS customer_phone text;

CREATE INDEX IF NOT EXISTS idx_assignments_role_id ON assignments(role_id)
  WHERE role_id IS NOT NULL;
