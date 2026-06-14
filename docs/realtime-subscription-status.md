# Supabase Realtime 구독 현황

> 마지막 갱신: 2026-06-14

## 구독 적용 현황

| 테이블 | INSERT | UPDATE | DELETE | 담당 훅 | 비고 |
|--------|--------|--------|--------|---------|------|
| `assignments` | ✅ | ✅ | ✅ | `useSchedule`, `useRealtime` | publication 적용, DEFAULT replica identity |
| `slot_highlights` | ✅ | ➖ | ✅ | `useSlotHighlights` | publication 적용, **REPLICA IDENTITY FULL** |
| `date_overrides` | ✅ | ✅ | ✅ | `useSchedule` | publication 적용, **REPLICA IDENTITY FULL** |

## 구독 미적용 (변경 시 새로고침 필요)

| 테이블 | 담당 훅 | 변경 빈도 | 실시간 필요성 |
|--------|---------|----------|-------------|
| `tenant_members` | `useAdmin`, `useProfiles`, `useDashboard` | 낮음 | 낮음 |
| `slot_settings` | `useSchedule`, `useDashboard` | 낮음 | 낮음 |
| `schedule_rules` | `useSchedule`, `useAdmin` | 낮음 | 낮음 |
| `date_overrides` | `useAdmin` (설정 UI) | 낮음 | 낮음 (구독으로 이전) |
| `tenant_roles` | `useTenantRoles` | 낮음 | 낮음 |
| `tenants` | `useAdmin` | 낮음 | 낮음 |
| `customers` | `useAdmin`, `useCustomerAdmin` | 낮음 | 낮음 |
| `profiles` | `useAdmin` | 낮음 | 낮음 |
| `assignment_snapshots` | `useAssignmentSnapshot` | 낮음 | 불필요 |

---

## 비용 폭탄 방지 체크리스트

### ✅ 1. 언마운트 시 구독 해제

컴포넌트가 사라질 때 반드시 구독을 해제해야 한다. 미해제 시 동시 접속 수·메시지 수 낭비.

```typescript
useEffect(() => {
  const channel = supabase.channel('...').on(...).subscribe()
  return () => { supabase.removeChannel(channel) }  // ← 필수
}, [tenantId])
```

**현재 상태**: `useSchedule`, `useSlotHighlights` 모두 적용 ✅

---

### ✅ 2. 필요한 데이터만 필터링해서 구독

테이블 전체를 구독하면 다른 조직의 이벤트까지 수신해 메시지 수가 폭발한다.
`tenant_id` 필터로 자신의 조직 데이터만 수신해야 한다.

```typescript
.on('postgres_changes', {
  event: 'INSERT',
  schema: 'public',
  table: 'slot_highlights',
  filter: `tenant_id=eq.${tenantId}`,  // ← 필수
}, handler)
```

**DELETE 필터 주의사항**:

| Replica Identity | DELETE payload.old | filter 적용 가능 여부 |
|-----------------|-------------------|----------------------|
| DEFAULT (기본값) | PK(`id`)만 포함 | ❌ filter 불가 — 서버가 이벤트 미전달 |
| **FULL** | 모든 컬럼 포함 | ✅ filter 가능 |

→ DELETE에도 tenant_id 필터를 걸려면 반드시 `REPLICA IDENTITY FULL`을 설정해야 한다.

```sql
ALTER TABLE <table_name> REPLICA IDENTITY FULL;
```

**현재 상태**:
- `slot_highlights`: REPLICA IDENTITY FULL 적용 → INSERT/DELETE 모두 필터 ✅
- `assignments`: DEFAULT → DELETE 필터 없음, PK(id)로 클라이언트 측 필터링 ✅ (트래픽 소량이므로 허용)

---

### ✅ 3. 고빈도 업데이트 테이블은 DB Realtime 대신 Broadcast 사용

1초에 수십 번 변경되는 데이터(마우스 위치, 센서 등)를 `postgres_changes`로 구독하면
DB 부하와 Realtime 메시지 비용이 동시에 폭발한다.

| 데이터 유형 | 권장 방식 |
|------------|---------|
| DB 영구 저장 데이터 (스케줄, 하이라이트 등) | `postgres_changes` (CDC) |
| 임시·고빈도 데이터 (커서, 알림 등) | `Broadcast` (DB 미경유) |

**현재 상태**: 구독 중인 테이블(`assignments`, `slot_highlights`) 모두 저빈도 ✅

---

## 새 테이블에 Realtime 추가 시 절차

1. `supabase/migrations/` 에 마이그레이션 파일 작성:
   ```sql
   ALTER TABLE <table_name> REPLICA IDENTITY FULL;  -- DELETE 필터 지원
   ALTER PUBLICATION supabase_realtime ADD TABLE <table_name>;
   ```

2. 훅에서 구독 추가 (INSERT·DELETE 모두 동일 filter):
   ```typescript
   supabase.channel(`<table>-${tenantId}`)
     .on('postgres_changes', { event: 'INSERT', ..., filter: `tenant_id=eq.${tenantId}` }, handler)
     .on('postgres_changes', { event: 'DELETE', ..., filter: `tenant_id=eq.${tenantId}` }, handler)
     .subscribe()
   ```

3. `docs/realtime-subscription-status.md` 표 갱신
