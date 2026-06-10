-- orphan tenant 존재 시 마이그레이션 중단 (운영 환경 안전장치)
DO $$
DECLARE v_count int;
BEGIN
  SELECT COUNT(*) INTO v_count FROM tenants WHERE customer_id IS NULL;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'Aborting: % orphan tenant(s) found. Review and remove manually before applying.', v_count;
  END IF;
END $$;

ALTER TABLE tenants ALTER COLUMN customer_id SET NOT NULL;

-- FK ON DELETE SET NULL → CASCADE 변경 (실제 제약명을 동적으로 조회)
DO $$
DECLARE
  v_constraint text;
BEGIN
  SELECT tc.constraint_name INTO v_constraint
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name AND tc.table_name = kcu.table_name
  WHERE tc.table_name = 'tenants'
    AND tc.constraint_type = 'FOREIGN KEY'
    AND kcu.column_name = 'customer_id';

  IF v_constraint IS NOT NULL THEN
    EXECUTE format('ALTER TABLE tenants DROP CONSTRAINT %I', v_constraint);
  END IF;
END $$;

ALTER TABLE tenants ADD CONSTRAINT tenants_customer_id_fkey
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;

ALTER TABLE customers ADD COLUMN IF NOT EXISTS deletion_requested_at timestamptz;

CREATE OR REPLACE FUNCTION cascade_customer_soft_delete()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
    UPDATE tenants
    SET is_active = NEW.is_active
    WHERE customer_id = NEW.id AND is_active IS DISTINCT FROM NEW.is_active;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_cascade_customer_soft_delete ON customers;
CREATE TRIGGER trg_cascade_customer_soft_delete
  AFTER UPDATE OF is_active ON customers
  FOR EACH ROW EXECUTE FUNCTION cascade_customer_soft_delete();
