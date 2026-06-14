# Supabase Realtime 구독 현황

> 마지막 갱신: 2026-06-14

## 구독 적용 현황

| 테이블 | INSERT | UPDATE | DELETE | 담당 훅 | 비고 |
|--------|--------|--------|--------|---------|------|
| `assignments` | ✅ | ✅ | ✅ | `useSchedule`, `useRealtime` | `supabase_realtime` publication 적용됨 |
| `slot_highlights` | ✅ | ➖ | ✅ | `useSlotHighlights` | `supabase_realtime` publication 적용됨 |

## 구독 미적용 (변경 시 새로고침 필요)

| 테이블 | 담당 훅 | 변경 빈도 | 실시간 필요성 |
|--------|---------|----------|-------------|
| `tenant_members` | `useAdmin`, `useProfiles`, `useDashboard` | 낮음 (회원 가입/탈퇴) | 낮음 |
| `slot_settings` | `useSchedule`, `useDashboard` | 낮음 (관리자 설정) | 낮음 |
| `schedule_rules` | `useSchedule`, `useAdmin` | 낮음 (관리자 설정) | 낮음 |
| `date_overrides` | `useSchedule`, `useAdmin` | 중간 (휴관·잠금 처리) | 중간 |
| `tenant_roles` | `useTenantRoles` | 낮음 (역할 설정) | 낮음 |
| `tenants` | `useAdmin` | 낮음 (조직 설정) | 낮음 |
| `customers` | `useAdmin`, `useCustomerAdmin` | 낮음 | 낮음 |
| `profiles` | `useAdmin` | 낮음 | 낮음 |
| `assignment_snapshots` | `useAssignmentSnapshot` | 낮음 (초기화/복구) | 불필요 |

## Realtime 추가 시 필요한 작업

새 테이블에 Realtime을 추가하려면 두 가지가 모두 필요하다.

1. **Publication 등록** (SQL Editor에서 실행):
   ```sql
   ALTER PUBLICATION supabase_realtime ADD TABLE <table_name>;
   ```

2. **훅에서 구독 코드 추가**:
   ```typescript
   supabase.channel('channel-name')
     .on('postgres_changes', { event: 'INSERT', schema: 'public', table: '<table_name>' }, handler)
     .on('postgres_changes', { event: 'DELETE', schema: 'public', table: '<table_name>' }, handler)
     // ⚠️ DELETE에는 filter 사용 금지 — DEFAULT replica identity에서 PK(id)만 payload.old에 포함됨
     .subscribe()
   ```

## 주의사항

- **DELETE 구독에 filter 금지**: DEFAULT replica identity 환경에서 DELETE `payload.old`에는 PK(`id`)만 포함된다. filter를 걸면 서버가 이벤트를 전달하지 않음. → id로 클라이언트 측 필터링할 것.
- **INSERT/UPDATE filter**: `payload.new`에 모든 컬럼이 있으므로 filter 사용 가능.
- `useRealtime`은 레거시 훅으로 현재 미사용 상태일 수 있음. `useSchedule`이 동일 기능을 담당.
