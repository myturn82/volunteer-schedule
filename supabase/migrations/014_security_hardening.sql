-- ============================================================
-- 014_security_hardening.sql
-- 멀티테넌트 RLS 전면 재작성
-- - 모든 테이블을 tenant_id 기반으로 격리
-- - handle_new_user: 메타데이터 role/is_super_admin 무시
-- - tenant_members 자가 신청 시 role=member, is_approved=false 강제
-- - profiles: 같은 테넌트 내에서만 조회 가능
-- ============================================================

-- ── 헬퍼 함수 (SECURITY DEFINER로 RLS 루프 방지) ─────────────────────────────
-- 기존 함수 DROP (파라미터명 충돌 방지)
DROP FUNCTION IF EXISTS public.is_tenant_member(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.is_tenant_admin(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.is_super_admin_caller() CASCADE;
DROP FUNCTION IF EXISTS public.shares_tenant_with(uuid) CASCADE;

CREATE OR REPLACE FUNCTION public.is_tenant_member(tid uuid)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM tenant_members
    WHERE tenant_id = tid
      AND user_id = auth.uid()
      AND is_approved = true
  )
$$;

CREATE OR REPLACE FUNCTION public.is_tenant_admin(tid uuid)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM tenant_members
    WHERE tenant_id = tid
      AND user_id = auth.uid()
      AND role = 'admin'
      AND is_approved = true
  )
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin_caller()
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND is_super_admin = true
  )
$$;

-- 다른 유저와 같은 테넌트에 속하는지 확인
CREATE OR REPLACE FUNCTION public.shares_tenant_with(other_user_id uuid)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM tenant_members me
    JOIN tenant_members them
      ON me.tenant_id = them.tenant_id
    WHERE me.user_id   = auth.uid()
      AND them.user_id = other_user_id
      AND me.is_approved   = true
      AND them.is_approved = true
  )
$$;

-- ── profiles ──────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "profiles_select_all"        ON profiles;
DROP POLICY IF EXISTS "profiles_superadmin_update" ON profiles;

-- 자기 자신 조회
CREATE POLICY "profiles_select_self" ON profiles
  FOR SELECT USING (id = auth.uid());

-- 같은 테넌트 멤버 조회 (이름 표시 목적)
CREATE POLICY "profiles_select_same_tenant" ON profiles
  FOR SELECT USING (shares_tenant_with(id));

-- 슈퍼어드민 전체 조회
CREATE POLICY "profiles_select_superadmin" ON profiles
  FOR SELECT USING (is_super_admin_caller());

-- 자기 자신 업데이트
-- (기존 profiles_update_own 유지)

-- 슈퍼어드민 업데이트 (is_approved, is_super_admin 변경용)
CREATE POLICY "profiles_superadmin_update" ON profiles
  FOR UPDATE USING (is_super_admin_caller());

-- ── assignments ───────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "assignments_select_all"    ON assignments;
DROP POLICY IF EXISTS "assignments_insert_own"    ON assignments;
DROP POLICY IF EXISTS "assignments_update_own"    ON assignments;
DROP POLICY IF EXISTS "assignments_delete_own"    ON assignments;
DROP POLICY IF EXISTS "assignments_admin_all"     ON assignments;

-- 같은 테넌트 승인 멤버만 조회
CREATE POLICY "assignments_tenant_select" ON assignments
  FOR SELECT USING (is_tenant_member(tenant_id));

-- 본인이 자기 tenant에 등록 (자기 user_id만)
CREATE POLICY "assignments_tenant_insert" ON assignments
  FOR INSERT WITH CHECK (
    user_id = auth.uid() AND is_tenant_member(tenant_id)
  );

-- 본인 배정 수정
CREATE POLICY "assignments_own_update" ON assignments
  FOR UPDATE USING (
    user_id = auth.uid() AND is_tenant_member(tenant_id)
  );

-- 본인 배정 삭제
CREATE POLICY "assignments_own_delete" ON assignments
  FOR DELETE USING (
    user_id = auth.uid() AND is_tenant_member(tenant_id)
  );

-- 테넌트 어드민 전체 조작
CREATE POLICY "assignments_admin_all" ON assignments
  FOR ALL USING (
    is_tenant_admin(tenant_id) OR is_super_admin_caller()
  );

-- ── slot_settings ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "slot_settings_select_all" ON slot_settings;
DROP POLICY IF EXISTS "slot_settings_admin_all"  ON slot_settings;

CREATE POLICY "slot_settings_tenant_select" ON slot_settings
  FOR SELECT USING (is_tenant_member(tenant_id));

CREATE POLICY "slot_settings_admin_all" ON slot_settings
  FOR ALL USING (is_tenant_admin(tenant_id) OR is_super_admin_caller());

-- ── schedule_rules ────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "schedule_rules_select_all" ON schedule_rules;
DROP POLICY IF EXISTS "schedule_rules_admin_all"  ON schedule_rules;

CREATE POLICY "schedule_rules_tenant_select" ON schedule_rules
  FOR SELECT USING (is_tenant_member(tenant_id));

CREATE POLICY "schedule_rules_admin_all" ON schedule_rules
  FOR ALL USING (is_tenant_admin(tenant_id) OR is_super_admin_caller());

-- ── date_overrides ────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "date_overrides_select_all" ON date_overrides;
DROP POLICY IF EXISTS "date_overrides_admin_all"  ON date_overrides;

CREATE POLICY "date_overrides_tenant_select" ON date_overrides
  FOR SELECT USING (is_tenant_member(tenant_id));

CREATE POLICY "date_overrides_admin_all" ON date_overrides
  FOR ALL USING (is_tenant_admin(tenant_id) OR is_super_admin_caller());

-- ── tenants ───────────────────────────────────────────────────────────────────
-- 가입 전 조직 목록 선택 필요 → SELECT는 모두 허용 (이름/모드만 노출)

DROP POLICY IF EXISTS "tenants_select_all" ON tenants;

CREATE POLICY "tenants_select_all" ON tenants
  FOR SELECT USING (true);

CREATE POLICY "tenants_admin_update" ON tenants
  FOR UPDATE USING (is_tenant_admin(id) OR is_super_admin_caller());

CREATE POLICY "tenants_superadmin_delete" ON tenants
  FOR DELETE USING (is_super_admin_caller());

CREATE POLICY "tenants_superadmin_insert" ON tenants
  FOR INSERT WITH CHECK (is_super_admin_caller());

-- ── tenant_roles ──────────────────────────────────────────────────────────────
-- 가입 전 활동유형 선택 필요 → SELECT는 모두 허용

DROP POLICY IF EXISTS "tenant_roles_select_all" ON tenant_roles;

CREATE POLICY "tenant_roles_select_all" ON tenant_roles
  FOR SELECT USING (true);

CREATE POLICY "tenant_roles_admin_all" ON tenant_roles
  FOR ALL USING (is_tenant_admin(tenant_id) OR is_super_admin_caller());

-- ── tenant_members ────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "tenant_members_self_insert" ON tenant_members;

-- 자가 신청: role=member, is_approved=false 강제
CREATE POLICY "tenant_members_self_apply" ON tenant_members
  FOR INSERT WITH CHECK (
    user_id      = auth.uid()
    AND role        = 'member'
    AND is_approved = false
  );

-- 자기 자신 조회 (승인 대기 중에도)
CREATE POLICY "tenant_members_self_select" ON tenant_members
  FOR SELECT USING (user_id = auth.uid());

-- 같은 테넌트 승인 멤버 조회
CREATE POLICY "tenant_members_tenant_select" ON tenant_members
  FOR SELECT USING (is_tenant_member(tenant_id) OR is_super_admin_caller());

-- 어드민만 업데이트 (승인, 역할 변경 등)
CREATE POLICY "tenant_members_admin_update" ON tenant_members
  FOR UPDATE USING (is_tenant_admin(tenant_id) OR is_super_admin_caller());

-- 어드민만 삭제 (추방)
CREATE POLICY "tenant_members_admin_delete" ON tenant_members
  FOR DELETE USING (is_tenant_admin(tenant_id) OR is_super_admin_caller());

-- ── handle_new_user: 메타데이터 role/is_super_admin/is_approved 완전 무시 ──────

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, avatar_url, role, is_approved, is_super_admin)
  VALUES (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1)
    ),
    new.email,
    coalesce(
      new.raw_user_meta_data->>'avatar_url',
      new.raw_user_meta_data->>'picture'
    ),
    'volunteer',  -- 항상 volunteer, 메타데이터 무시
    false,        -- 관리자가 직접 승인해야 함
    false         -- DB에서만 super_admin 부여
  )
  ON CONFLICT (id) DO NOTHING;

  -- 조직 선택 후 가입 시 tenant_members 자동 추가
  -- role=member, is_approved=false 강제 (관리자 승인 필요)
  IF new.raw_user_meta_data->>'tenant_id' IS NOT NULL THEN
    INSERT INTO public.tenant_members (tenant_id, user_id, role, role_id, is_approved)
    VALUES (
      (new.raw_user_meta_data->>'tenant_id')::uuid,
      new.id,
      'member',
      CASE
        WHEN new.raw_user_meta_data->>'tenant_role_id' IS NOT NULL
        THEN (new.raw_user_meta_data->>'tenant_role_id')::uuid
        ELSE NULL
      END,
      false  -- 항상 미승인, 관리자 승인 필요
    )
    ON CONFLICT (tenant_id, user_id) DO NOTHING;
  END IF;

  RETURN new;
END;
$$;
