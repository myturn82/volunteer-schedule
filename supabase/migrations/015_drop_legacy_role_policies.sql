-- 015_drop_legacy_role_policies.sql
-- Remove remaining legacy policies that reference profiles.role directly
-- (replaced by tenant-scoped policies in 013).
-- Safe to run after 013 is fully applied and verified.

-- profiles: drop the old blanket select-all (replaced in 013)
drop policy if exists "profiles_select_all" on profiles;

-- Any remaining role='admin' or role='team_leader' wide policies on assignments
-- that may have survived from 008_team_leader.sql:
drop policy if exists "assignments_team_leader_all" on assignments;
drop policy if exists "slot_settings_team_leader_all" on slot_settings;

-- Note: profiles.role column is kept for backward compatibility with
-- existing frontend code that reads it for display purposes (e.g. ROLE_LABELS).
-- The authorization logic now uses tenant_members.role instead.
