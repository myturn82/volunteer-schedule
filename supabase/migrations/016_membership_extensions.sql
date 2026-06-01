-- supabase/migrations/016_membership_extensions.sql

ALTER TABLE tenant_members
  ADD COLUMN IF NOT EXISTS withdrawal_status        text NOT NULL DEFAULT 'none'
    CHECK (withdrawal_status IN ('none', 'pending', 'approved')),
  ADD COLUMN IF NOT EXISTS withdrawal_requested_at  timestamptz,
  ADD COLUMN IF NOT EXISTS withdrawal_approved_at   timestamptz,
  ADD COLUMN IF NOT EXISTS available_days           int[]  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS monthly_limit            int    DEFAULT NULL;
