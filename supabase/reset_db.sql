-- ============================================================
-- 운영 DB 초기화 스크립트 (전체 재생성)
-- 생성일: 2026-06-10
-- 기준 마이그레이션: 001 ~ 050
--
-- ⚠️  주의: 이 스크립트는 모든 데이터를 삭제합니다.
--           Supabase SQL Editor에서 직접 실행하세요.
--           실행 전 반드시 백업을 먼저 수행하세요.
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- STEP 1. 기존 오브젝트 삭제
-- ────────────────────────────────────────────────────────────

-- 트리거 삭제
DROP TRIGGER IF EXISTS on_auth_user_created            ON auth.users;
DROP TRIGGER IF EXISTS trg_cascade_customer_soft_delete ON customers;
DROP TRIGGER IF EXISTS trg_assignments_lock_update      ON assignments;
DROP TRIGGER IF EXISTS trg_assignments_lock_delete      ON assignments;
DROP TRIGGER IF EXISTS trg_assignments_date_lock_insert ON assignments;

-- 함수 삭제
DROP FUNCTION IF EXISTS public.handle_new_user()                CASCADE;
DROP FUNCTION IF EXISTS public.is_tenant_member(uuid)           CASCADE;
DROP FUNCTION IF EXISTS public.is_tenant_admin(uuid)            CASCADE;
DROP FUNCTION IF EXISTS public.is_super_admin()                 CASCADE;
DROP FUNCTION IF EXISTS public.is_super_admin_caller()          CASCADE;
DROP FUNCTION IF EXISTS public.shares_tenant_with(uuid)         CASCADE;
DROP FUNCTION IF EXISTS public.customer_has_active_tenant(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.cascade_customer_soft_delete()   CASCADE;
DROP FUNCTION IF EXISTS public.admin_update_member_name(uuid, text) CASCADE;
DROP FUNCTION IF EXISTS public.check_assignment_lock_update()   CASCADE;
DROP FUNCTION IF EXISTS public.check_assignment_lock_delete()   CASCADE;
DROP FUNCTION IF EXISTS public.check_assignment_date_lock_insert() CASCADE;

-- 테이블 삭제 (CASCADE로 FK·인덱스·정책 자동 제거)
DROP TABLE IF EXISTS slot_highlights        CASCADE;
DROP TABLE IF EXISTS assignment_snapshots CASCADE;
DROP TABLE IF EXISTS plan_limits    CASCADE;
DROP TABLE IF EXISTS date_overrides CASCADE;
DROP TABLE IF EXISTS schedule_rules CASCADE;
DROP TABLE IF EXISTS slot_settings  CASCADE;
DROP TABLE IF EXISTS assignments    CASCADE;
DROP TABLE IF EXISTS tenant_members CASCADE;
DROP TABLE IF EXISTS tenant_roles   CASCADE;
DROP TABLE IF EXISTS tenants        CASCADE;
DROP TABLE IF EXISTS customers      CASCADE;
DROP TABLE IF EXISTS profiles       CASCADE;


-- ────────────────────────────────────────────────────────────
-- STEP 2. 테이블 생성 (FK 의존 순서)
-- ────────────────────────────────────────────────────────────

-- profiles
CREATE TABLE profiles (
  id             uuid        PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  name           text        NOT NULL,
  email          text,
  avatar_url     text,
  is_approved    boolean     NOT NULL DEFAULT false,
  is_super_admin boolean     NOT NULL DEFAULT false,
  terms_agreed_at   timestamptz,
  privacy_agreed_at timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- customers
CREATE TABLE customers (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  text        NOT NULL,
  phone                 text,
  owner_user_id         uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  plan                  text        NOT NULL DEFAULT 'basic'
                                    CHECK (plan IN ('basic', 'pro', 'business')),
  plan_expires_at       timestamptz,
  is_active             boolean     NOT NULL DEFAULT true,
  deletion_requested_at timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- tenants
CREATE TABLE tenants (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          text        NOT NULL UNIQUE
                            CHECK (slug ~ '^[a-z0-9]([a-z0-9-]{0,38}[a-z0-9])?$'),
  name          text        NOT NULL,
  business_type text,
  settings      jsonb       NOT NULL DEFAULT '{}'::jsonb,
  is_active     boolean     NOT NULL DEFAULT true,
  customer_id   uuid        NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- tenant_roles
CREATE TABLE tenant_roles (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id              uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name                   text        NOT NULL,
  is_manager             boolean     NOT NULL DEFAULT false,
  display_order          int         NOT NULL DEFAULT 0,
  split_cell             boolean     NOT NULL DEFAULT false,
  requires_customer_info boolean     NOT NULL DEFAULT false,
  indicator_bar          boolean              DEFAULT false,
  created_at             timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);

-- tenant_members
CREATE TABLE tenant_members (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               uuid        NOT NULL REFERENCES tenants(id)      ON DELETE CASCADE,
  user_id                 uuid        NOT NULL REFERENCES profiles(id)     ON DELETE CASCADE,
  role                    text        NOT NULL DEFAULT 'member'
                                      CHECK (role IN ('admin', 'member')),
  role_id                 uuid        REFERENCES tenant_roles(id)          ON DELETE SET NULL,
  is_approved             boolean     NOT NULL DEFAULT false,
  withdrawal_status       text        NOT NULL DEFAULT 'none'
                                      CHECK (withdrawal_status IN ('none', 'pending', 'approved')),
  withdrawal_requested_at timestamptz,
  withdrawal_approved_at  timestamptz,
  available_days          int[],
  monthly_limit           int,
  created_at              timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id)
);

-- assignments
-- time_slot: 정규식으로 체크 (30분 단위 포함, 예: '10.5-11')
CREATE TABLE assignments (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  year           int         NOT NULL,
  month          int         NOT NULL CHECK (month BETWEEN 1 AND 12),
  day            int         NOT NULL CHECK (day   BETWEEN 1 AND 31),
  time_slot      text        NOT NULL
                             CHECK (time_slot ~ '^[0-9]{1,2}(\.[0-9]+)?-[0-9]{1,2}(\.[0-9]+)?$'),
  member_name    text        NOT NULL,
  member_type    text        NOT NULL DEFAULT 'member',
  time_sub       text,
  note           text,
  color          text,
  extra_data     jsonb                DEFAULT '{}'::jsonb,
  user_id        uuid        REFERENCES profiles(id)     ON DELETE SET NULL,
  tenant_id      uuid        NOT NULL REFERENCES tenants(id)      ON DELETE CASCADE,
  role_id        uuid        REFERENCES tenant_roles(id) ON DELETE SET NULL,
  customer_name  text,
  customer_phone text,
  is_locked      boolean     NOT NULL DEFAULT false,
  account_deleted boolean    NOT NULL DEFAULT false,
  created_at     timestamptz          DEFAULT now()
);

-- slot_settings
CREATE TABLE slot_settings (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  time_slot    text        NOT NULL
               CHECK (time_slot ~ '^[0-9]{1,2}(\.[0-9]+)?-[0-9]{1,2}(\.[0-9]+)?$'),
  max_capacity int         NOT NULL DEFAULT 2,
  updated_by   uuid        REFERENCES profiles(id),
  tenant_id    uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  UNIQUE (tenant_id, time_slot)
);

-- schedule_rules
CREATE TABLE schedule_rules (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  day_of_week int         NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  time_slot   text        NOT NULL
              CHECK (time_slot ~ '^[0-9]{1,2}(\.[0-9]+)?-[0-9]{1,2}(\.[0-9]+)?$'),
  is_open     boolean     NOT NULL DEFAULT true,
  tenant_id   uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  CONSTRAINT schedule_rules_tenant_day_slot_unique UNIQUE (tenant_id, day_of_week, time_slot)
);

-- date_overrides
CREATE TABLE date_overrides (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  date       date        NOT NULL,
  is_open    boolean     NOT NULL DEFAULT true,
  is_holiday boolean     NOT NULL DEFAULT false,
  is_locked  boolean     NOT NULL DEFAULT false,
  label      text,
  tenant_id  uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  UNIQUE (tenant_id, date)
);

-- plan_limits
CREATE TABLE plan_limits (
  plan       text        PRIMARY KEY CHECK (plan IN ('basic', 'pro', 'business')),
  max_orgs   integer,
  max_users  integer,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- assignment_snapshots
CREATE TABLE assignment_snapshots (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  year           INT         NOT NULL,
  month          INT         NOT NULL CHECK (month BETWEEN 1 AND 12),
  scope          TEXT        NOT NULL CHECK (scope IN ('month', 'week', 'day')),
  days           INT[],
  snapshot_data  JSONB       NOT NULL,
  deleted_count  INT         NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by     UUID        REFERENCES auth.users(id) ON DELETE SET NULL
);


-- slot_highlights
CREATE TABLE slot_highlights (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  date        DATE        NOT NULL,
  time_slot   TEXT        NOT NULL,
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, date, time_slot)
);

-- ────────────────────────────────────────────────────────────
-- STEP 3. 인덱스
-- ────────────────────────────────────────────────────────────

CREATE INDEX idx_customers_owner          ON customers(owner_user_id);
CREATE INDEX idx_tenants_customer         ON tenants(customer_id);
CREATE INDEX idx_tenant_roles_tenant      ON tenant_roles(tenant_id);
CREATE INDEX idx_tenant_members_tenant    ON tenant_members(tenant_id);
CREATE INDEX idx_tenant_members_user      ON tenant_members(user_id);
CREATE INDEX idx_assignments_tenant       ON assignments(tenant_id);
CREATE INDEX idx_assignments_tenant_ym    ON assignments(tenant_id, year, month);
CREATE INDEX idx_assignments_role_id      ON assignments(role_id) WHERE role_id IS NOT NULL;
CREATE INDEX idx_slot_settings_tenant     ON slot_settings(tenant_id);
CREATE INDEX idx_schedule_rules_tenant    ON schedule_rules(tenant_id);
CREATE INDEX idx_date_overrides_tenant    ON date_overrides(tenant_id);
CREATE INDEX idx_date_overrides_tenant_dt ON date_overrides(tenant_id, date);
CREATE INDEX idx_assignment_snapshots_lookup
  ON assignment_snapshots(tenant_id, year, month, created_at DESC);
CREATE INDEX idx_slot_highlights_tenant_date
  ON slot_highlights(tenant_id, date);

-- 같은 조직·날짜·시간대에 동일 이름 중복 방지 (admin_note 제외)
CREATE UNIQUE INDEX unique_member_assignment
  ON assignments (tenant_id, year, month, day, time_slot, member_name)
  WHERE member_type != 'admin_note';


-- ────────────────────────────────────────────────────────────
-- STEP 4. RLS 활성화
-- ────────────────────────────────────────────────────────────

ALTER TABLE profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers      ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants        ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_roles   ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments    ENABLE ROW LEVEL SECURITY;
ALTER TABLE slot_settings  ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE date_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_limits             ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignment_snapshots    ENABLE ROW LEVEL SECURITY;
ALTER TABLE slot_highlights         ENABLE ROW LEVEL SECURITY;


-- ────────────────────────────────────────────────────────────
-- STEP 5. 헬퍼 함수 (SECURITY DEFINER — RLS 루프 방지)
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.is_tenant_member(tid uuid)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM tenant_members
    WHERE tenant_id = tid
      AND user_id   = auth.uid()
      AND is_approved = true
  );
$$;

CREATE OR REPLACE FUNCTION public.is_tenant_admin(tid uuid)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM tenant_members
    WHERE tenant_id  = tid
      AND user_id    = auth.uid()
      AND role       = 'admin'
      AND is_approved = true
  );
$$;

-- 단순 bool 반환 (coalesce 방식)
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT is_super_admin FROM profiles WHERE id = auth.uid()),
    false
  );
$$;

-- EXISTS 방식 (일부 정책에서 사용)
CREATE OR REPLACE FUNCTION public.is_super_admin_caller()
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND is_super_admin = true
  );
$$;

-- 같은 테넌트에 속한 승인된 멤버인지 확인
CREATE OR REPLACE FUNCTION public.shares_tenant_with(other_user_id uuid)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM tenant_members me
    JOIN tenant_members them ON me.tenant_id = them.tenant_id
    WHERE me.user_id    = auth.uid()
      AND them.user_id  = other_user_id
      AND me.is_approved   = true
      AND them.is_approved = true
  );
$$;

-- 활성 테넌트가 있는 고객인지 확인 (tenants RLS 우회용)
CREATE OR REPLACE FUNCTION public.customer_has_active_tenant(p_customer_id uuid)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM tenants
    WHERE customer_id = p_customer_id AND is_active = true
  );
$$;

-- 조직 관리자(이상)가 멤버의 성명을 직접 수정할 수 있는 RPC
-- 카카오 등 소셜 로그인 시 닉네임/계정ID가 성명으로 들어가는 경우를 관리자가 보정할 수 있도록 함
CREATE OR REPLACE FUNCTION public.admin_update_member_name(p_user_id uuid, p_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text := trim(p_name);
BEGIN
  IF v_name = '' THEN
    RAISE EXCEPTION '이름을 입력해 주세요.';
  END IF;

  IF NOT (
    is_super_admin_caller()
    OR EXISTS (
      SELECT 1 FROM tenant_members tm_target
      JOIN tenant_members tm_admin
        ON tm_admin.tenant_id = tm_target.tenant_id
       AND tm_admin.user_id = auth.uid()
       AND tm_admin.role = 'admin'
      WHERE tm_target.user_id = p_user_id
    )
  ) THEN
    RAISE EXCEPTION '권한이 없습니다.';
  END IF;

  UPDATE profiles SET name = v_name WHERE id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_update_member_name(uuid, text) TO authenticated;


-- ────────────────────────────────────────────────────────────
-- STEP 6. RLS 정책
-- ────────────────────────────────────────────────────────────

-- ── profiles ─────────────────────────────────────────────────
CREATE POLICY "profiles_select_self" ON profiles
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "profiles_select_same_tenant" ON profiles
  FOR SELECT USING (shares_tenant_with(id));

CREATE POLICY "profiles_select_superadmin" ON profiles
  FOR SELECT USING (is_super_admin_caller());

CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "profiles_superadmin_update" ON profiles
  FOR UPDATE USING (is_super_admin_caller());

-- ── customers ────────────────────────────────────────────────
-- 자신이 소유한 고객 또는 슈퍼어드민
CREATE POLICY "customers_select_own" ON customers
  FOR SELECT USING (owner_user_id = auth.uid() OR is_super_admin());

-- 활성 테넌트가 있는 고객 (가입 UI에서 서비스명 표시용)
CREATE POLICY "customers_select_has_active_tenant" ON customers
  FOR SELECT USING (customer_has_active_tenant(id));

CREATE POLICY "customers_insert_own" ON customers
  FOR INSERT WITH CHECK (owner_user_id = auth.uid() OR is_super_admin());

CREATE POLICY "customers_update_own" ON customers
  FOR UPDATE USING (owner_user_id = auth.uid() OR is_super_admin());

CREATE POLICY "customers_delete_super_admin" ON customers
  FOR DELETE USING (is_super_admin());

-- ── tenants ──────────────────────────────────────────────────
-- 활성 조직은 누구나 조회 (가입 선택용), 비활성은 슈퍼어드민만
CREATE POLICY "tenants_select" ON tenants
  FOR SELECT USING (is_active = true OR is_super_admin_caller());

-- 슈퍼어드민 또는 고객 소유자가 조직 생성
CREATE POLICY "tenants_insert_customer_owner" ON tenants
  FOR INSERT WITH CHECK (
    is_super_admin()
    OR EXISTS (
      SELECT 1 FROM customers
      WHERE id = tenants.customer_id
        AND owner_user_id = auth.uid()
        AND is_active = true
    )
  );

-- 슈퍼어드민·테넌트어드민·고객 소유자가 수정
CREATE POLICY "tenants_update_customer_owner" ON tenants
  FOR UPDATE USING (
    is_super_admin()
    OR is_tenant_admin(id)
    OR EXISTS (
      SELECT 1 FROM customers
      WHERE id = tenants.customer_id
        AND owner_user_id = auth.uid()
        AND is_active = true
    )
  );

CREATE POLICY "tenants_superadmin_delete" ON tenants
  FOR DELETE USING (is_super_admin_caller());

-- ── tenant_roles ─────────────────────────────────────────────
CREATE POLICY "tenant_roles_select_all" ON tenant_roles
  FOR SELECT USING (true);

CREATE POLICY "tenant_roles_admin_all" ON tenant_roles
  FOR ALL USING (is_tenant_admin(tenant_id) OR is_super_admin_caller());

-- ── tenant_members ───────────────────────────────────────────
-- 자가 신청: role=member, is_approved=false 강제
CREATE POLICY "tenant_members_self_apply" ON tenant_members
  FOR INSERT WITH CHECK (
    user_id     = auth.uid()
    AND role       = 'member'
    AND is_approved = false
  );

-- 고객 소유자 또는 슈퍼어드민은 admin으로 직접 등록 가능
CREATE POLICY "tenant_members_customer_owner_insert" ON tenant_members
  FOR INSERT WITH CHECK (
    is_super_admin()
    OR EXISTS (
      SELECT 1 FROM tenants t
      JOIN customers c ON c.id = t.customer_id
      WHERE t.id = tenant_members.tenant_id
        AND c.owner_user_id = auth.uid()
        AND c.is_active = true
    )
  );

-- 자기 자신 조회 (승인 대기 중에도)
CREATE POLICY "tenant_members_self_select" ON tenant_members
  FOR SELECT USING (user_id = auth.uid());

-- 같은 테넌트 승인 멤버 조회
CREATE POLICY "tenant_members_tenant_select" ON tenant_members
  FOR SELECT USING (is_tenant_member(tenant_id) OR is_super_admin_caller());

-- 어드민만 수정 (승인, 역할 변경)
CREATE POLICY "tenant_members_admin_update" ON tenant_members
  FOR UPDATE USING (is_tenant_admin(tenant_id) OR is_super_admin_caller());

-- 어드민만 삭제 (추방)
CREATE POLICY "tenant_members_admin_delete" ON tenant_members
  FOR DELETE USING (is_tenant_admin(tenant_id) OR is_super_admin_caller());

-- ── assignments ──────────────────────────────────────────────
CREATE POLICY "assignments_tenant_select" ON assignments
  FOR SELECT USING (is_tenant_member(tenant_id) OR is_super_admin_caller());

-- 본인 등록 (비회원 모드에서는 user_id=NULL 허용)
CREATE POLICY "assignments_tenant_insert" ON assignments
  FOR INSERT WITH CHECK (
    is_tenant_member(tenant_id) AND (user_id = auth.uid() OR user_id IS NULL)
  );

-- 어드민·슈퍼어드민이 대신 등록
CREATE POLICY "assignments_insert_admin" ON assignments
  FOR INSERT WITH CHECK (
    is_tenant_admin(tenant_id) OR is_super_admin_caller()
  );

CREATE POLICY "assignments_own_update" ON assignments
  FOR UPDATE USING (
    (user_id = auth.uid() AND is_tenant_member(tenant_id))
    OR is_tenant_admin(tenant_id)
    OR is_super_admin_caller()
  );

CREATE POLICY "assignments_own_delete" ON assignments
  FOR DELETE USING (
    (user_id = auth.uid() AND is_tenant_member(tenant_id))
    OR is_tenant_admin(tenant_id)
    OR is_super_admin_caller()
  );

CREATE POLICY "assignments_admin_all" ON assignments
  FOR ALL USING (is_tenant_admin(tenant_id) OR is_super_admin_caller());

-- ── slot_settings ────────────────────────────────────────────
CREATE POLICY "slot_settings_tenant_select" ON slot_settings
  FOR SELECT USING (is_tenant_member(tenant_id) OR is_super_admin_caller());

CREATE POLICY "slot_settings_admin_all" ON slot_settings
  FOR ALL USING (is_tenant_admin(tenant_id) OR is_super_admin_caller());

-- ── schedule_rules ───────────────────────────────────────────
CREATE POLICY "schedule_rules_tenant_select" ON schedule_rules
  FOR SELECT USING (is_tenant_member(tenant_id) OR is_super_admin_caller());

CREATE POLICY "schedule_rules_admin_all" ON schedule_rules
  FOR ALL USING (is_tenant_admin(tenant_id) OR is_super_admin_caller());

-- ── date_overrides ───────────────────────────────────────────
CREATE POLICY "date_overrides_tenant_select" ON date_overrides
  FOR SELECT USING (is_tenant_member(tenant_id) OR is_super_admin_caller());

CREATE POLICY "date_overrides_admin_all" ON date_overrides
  FOR ALL USING (is_tenant_admin(tenant_id) OR is_super_admin_caller());

-- ── plan_limits ──────────────────────────────────────────────
CREATE POLICY "plan_limits_select_authenticated" ON plan_limits
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "plan_limits_update_super_admin" ON plan_limits
  FOR UPDATE USING (is_super_admin()) WITH CHECK (is_super_admin());

-- ── assignment_snapshots ──────────────────────────────────────
CREATE POLICY "snapshots_admin_all" ON assignment_snapshots
  FOR ALL
  USING  (is_tenant_admin(tenant_id) OR is_super_admin())
  WITH CHECK (is_tenant_admin(tenant_id) OR is_super_admin());

-- ── slot_highlights ───────────────────────────────────────────
CREATE POLICY "slot_highlights_admin_all" ON slot_highlights
  FOR ALL
  USING  (is_tenant_admin(tenant_id) OR is_super_admin())
  WITH CHECK (is_tenant_admin(tenant_id) OR is_super_admin());
CREATE POLICY "slot_highlights_member_select" ON slot_highlights
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tenant_members
      WHERE tenant_members.tenant_id = slot_highlights.tenant_id
        AND tenant_members.user_id = auth.uid()
    ) OR is_super_admin()
  );


-- ────────────────────────────────────────────────────────────
-- STEP 7. 트리거
-- ────────────────────────────────────────────────────────────

-- 신규 사용자 등록 시 profiles 자동 생성
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, avatar_url, is_approved, is_super_admin, terms_agreed_at, privacy_agreed_at)
  VALUES (
    new.id,
    COALESCE(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1)
    ),
    new.email,
    COALESCE(
      new.raw_user_meta_data->>'avatar_url',
      new.raw_user_meta_data->>'picture'
    ),
    false,        -- 관리자 승인 필요
    false,        -- DB에서만 super_admin 부여
    (new.raw_user_meta_data->>'terms_agreed_at')::timestamptz,
    (new.raw_user_meta_data->>'privacy_agreed_at')::timestamptz
  )
  ON CONFLICT (id) DO NOTHING;

  -- 가입 시 조직 선택했으면 tenant_members에 자동 추가
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
      false
    )
    ON CONFLICT (tenant_id, user_id) DO NOTHING;
  END IF;

  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 고객 비활성화 시 소속 테넌트 cascade 소프트 삭제
CREATE OR REPLACE FUNCTION public.cascade_customer_soft_delete()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
    UPDATE tenants
    SET is_active = NEW.is_active
    WHERE customer_id = NEW.id
      AND is_active IS DISTINCT FROM NEW.is_active;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cascade_customer_soft_delete ON customers;
CREATE TRIGGER trg_cascade_customer_soft_delete
  AFTER UPDATE OF is_active ON customers
  FOR EACH ROW EXECUTE FUNCTION public.cascade_customer_soft_delete();

-- 배정 건 고정(hold): 잠긴 행은 그 누구도(슈퍼관리자 포함) 수정 불가하며,
-- 잠금 해제(is_locked: true -> false)만 슈퍼관리자에게 허용한다.
-- 단, 계정 삭제로 인한 user_id -> NULL 변경(FK ON DELETE SET NULL cascade) 및
-- 그에 따른 account_deleted 플래그 설정은 예외로 허용한다.
CREATE OR REPLACE FUNCTION public.check_assignment_lock_update()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  new_cmp assignments;
  old_cmp assignments;
  account_deleted_now boolean;
BEGIN
  account_deleted_now := (NEW.user_id IS NULL AND OLD.user_id IS NOT NULL);

  IF OLD.is_locked THEN
    new_cmp := NEW;
    old_cmp := OLD;
    new_cmp.is_locked := false;
    old_cmp.is_locked := false;

    -- 계정 삭제로 인한 user_id -> NULL 변경 및 account_deleted 플래그 설정은 허용
    IF account_deleted_now THEN
      new_cmp.user_id := old_cmp.user_id;
      new_cmp.account_deleted := old_cmp.account_deleted;
    END IF;

    -- 잠긴 동안 잠금 여부 외 다른 필드 변경은 전면 차단
    IF new_cmp IS DISTINCT FROM old_cmp THEN
      RAISE EXCEPTION 'assignment is locked';
    END IF;

    -- 잠금 해제는 슈퍼관리자만 가능
    IF NEW.is_locked IS DISTINCT FROM OLD.is_locked AND NOT is_super_admin_caller() THEN
      RAISE EXCEPTION 'only super admin can unlock';
    END IF;
  ELSE
    -- 잠금 설정(false -> true)은 관리자 이상만 가능
    IF NEW.is_locked IS DISTINCT FROM OLD.is_locked
       AND NOT (is_tenant_admin(OLD.tenant_id) OR is_super_admin_caller()) THEN
      RAISE EXCEPTION 'only admins can change lock status';
    END IF;
  END IF;

  IF account_deleted_now THEN
    NEW.account_deleted := true;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assignments_lock_update ON assignments;
CREATE TRIGGER trg_assignments_lock_update
  BEFORE UPDATE ON assignments
  FOR EACH ROW EXECUTE FUNCTION check_assignment_lock_update();

-- 배정 건 고정(hold): 잠긴 행은 누구도 삭제 불가 (슈퍼관리자도 예외 없음)
CREATE OR REPLACE FUNCTION public.check_assignment_lock_delete()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  IF OLD.is_locked THEN
    RAISE EXCEPTION 'assignment is locked';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_assignments_lock_delete ON assignments;
CREATE TRIGGER trg_assignments_lock_delete
  BEFORE DELETE ON assignments
  FOR EACH ROW EXECUTE FUNCTION check_assignment_lock_delete();

-- 날짜 단위 잠금: date_overrides.is_locked인 날짜에는 누구도(관리자 포함) 새 배정 추가 불가
CREATE OR REPLACE FUNCTION public.check_assignment_date_lock_insert()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM date_overrides
    WHERE tenant_id = NEW.tenant_id
      AND date = make_date(NEW.year, NEW.month, NEW.day)
      AND is_locked
  ) THEN
    RAISE EXCEPTION 'date is locked';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assignments_date_lock_insert ON assignments;
CREATE TRIGGER trg_assignments_date_lock_insert
  BEFORE INSERT ON assignments
  FOR EACH ROW EXECUTE FUNCTION check_assignment_date_lock_insert();


-- ────────────────────────────────────────────────────────────
-- STEP 8. Realtime 활성화
-- ────────────────────────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE assignments;
ALTER PUBLICATION supabase_realtime ADD TABLE slot_highlights;
ALTER TABLE slot_highlights REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE date_overrides;
ALTER TABLE date_overrides REPLICA IDENTITY FULL;


-- ────────────────────────────────────────────────────────────
-- STEP 9. 초기 데이터
-- ────────────────────────────────────────────────────────────

-- 요금제별 기본 제한 (슈퍼어드민이 나중에 수정 가능)
INSERT INTO plan_limits (plan, max_orgs, max_users) VALUES
  ('basic',    1,    20),
  ('pro',      5,   100),
  ('business', null, null)
ON CONFLICT (plan) DO NOTHING;


-- ────────────────────────────────────────────────────────────
-- STEP 10. 슈퍼어드민 지정 (직접 실행)
-- ────────────────────────────────────────────────────────────
-- 회원가입 후 아래 SQL을 Supabase SQL Editor에서 실행하세요:
--
--   UPDATE profiles
--   SET is_super_admin = true
--   WHERE email = 'yjsong82@gmail.com';
--
-- ============================================================
