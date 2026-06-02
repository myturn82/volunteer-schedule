-- assignments.user_id FK를 ON DELETE CASCADE → ON DELETE SET NULL 로 변경
-- 계정 삭제 시 배정 내역이 같이 삭제되는 문제 방지

ALTER TABLE assignments DROP CONSTRAINT assignments_user_id_fkey;
ALTER TABLE assignments ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE assignments ADD CONSTRAINT assignments_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE SET NULL;
