# 조직 모드 3종 · 회원 탈퇴 · 자동배정 옵션 설계

**날짜**: 2026-06-01  
**범위**: Feature 7 (조직 모드), Feature 8 (회원 탈퇴), Feature 5 (자동배정 옵션)  
**구현 순서**: Feature 7 → Feature 8 → Feature 5

---

## Feature 7 — 조직 운영 모드 3종

### 개요
기존 `'회원선택' | '직접입력'` 2종을 `'회원공유' | '회원개별' | '비회원'` 3종으로 재정의.

| 새 모드 | 기존 대응 | 설명 |
|---------|---------|------|
| `'회원공유'` | `'회원선택'` | 회원들이 서로의 스케줄 확인 가능 (동작 불변) |
| `'회원개별'` | *(신규)* | 관리자는 전체 조회+회원 필터, 회원은 본인 배정만 표시 |
| `'비회원'` | `'직접입력'` | 이름+연락처 직접입력 방식 (동작 불변) |

### 데이터 모델
`tenants.settings.tenant_mode` JSONB 필드를 3종 값으로 확장.  
**DB 마이그레이션 불필요** — JSONB는 새 값 즉시 수용.

**하위 호환**: `TenantContext`에서 `'회원선택'` → `'회원공유'`로 정규화 (기존 조직 자동 전환).

```typescript
// types/index.ts
type TenantMode = '회원공유' | '회원개별' | '비회원'
```

### 변경 파일 및 상세 동작

#### `src/types/index.ts`
- `TenantMode` 타입 추가 또는 수정

#### `src/contexts/TenantContext.tsx`
- `tenantMode` 반환 시:
  ```typescript
  const raw = settings?.tenant_mode
  const tenantMode: TenantMode =
    raw === '회원선택' ? '회원공유'
    : raw === '직접입력' ? '비회원'
    : (raw as TenantMode) ?? '회원공유'
  ```

#### `src/pages/SuperAdminPage.tsx`
- `CreateForm.tenant_mode` 타입: `'회원공유' | '회원개별' | '비회원'`
- 모드 선택 UI: `['회원공유', '회원개별', '비회원']` 3종 라디오
- `saveMode()`: 3종 값 처리
- 목록에서 기존 `'회원선택'` 표시는 `'회원공유'`로 렌더링
- 기존 toggle 버튼(2종) → 3종 드롭다운 또는 라디오로 교체

#### `src/components/modals/SlotEditModal.tsx`
- `tenantMode` 타입 업데이트
- `isFreeform = tenantMode === '비회원'`

#### `src/pages/SchedulePage.tsx`
- 자동배정 버튼 표시 조건: `tenantMode !== '비회원'` (공유·개별 모두 가능)
- 자동배정 실행 조건: `tenantMode !== '비회원'`
- 자기 배정 제한 조건: `tenantMode !== '비회원'`
- **회원개별 모드 — 관리자 필터**:
  ```typescript
  const [filterMemberId, setFilterMemberId] = useState<string | null>(null)
  ```
  - 스케줄 뷰 상단에 회원 드롭다운 추가 (회원개별+관리자/ 시에만 표시)
  - `displayAssignments = filterMemberId
      ? assignments.filter(a => a.user_id === filterMemberId)
      : assignments`
- **회원개별 모드 — 일반 회원**:
  - `displayAssignments = assignments.filter(a => a.user_id === profile.id)`
  - `getCellState()`는 **전체 `assignments`** 기준 유지 (정원 계산 정확성 보장)
  - 그리드/셀에는 `displayAssignments` 전달

#### 그리드 컴포넌트 (`ScheduleGrid`, `WeekGrid`, `DayView`)
- `displayAssignments` prop 추가 (정원 계산용 `assignments`와 분리)
- 셀 렌더링: `displayAssignments` 기준으로 이름 표시
- 정원 계산: 기존 `assignments` 기준 유지

---

## Feature 8 — 조직별 회원 탈퇴2

### 개요
회원이 탈퇴 신청 → 관리자 승인 → 탈퇴 처리.  
탈퇴 후 기존 배정 기록은 유지하되 취소선으로 표시.

### DB 마이그레이션 (migration `016_membership_extensions.sql`)
```sql
ALTER TABLE tenant_memberships
  ADD COLUMN IF NOT EXISTS withdrawal_status        text DEFAULT 'none'
    CHECK (withdrawal_status IN ('none', 'pending', 'approved')),
  ADD COLUMN IF NOT EXISTS withdrawal_requested_at  timestamptz,
  ADD COLUMN IF NOT EXISTS withdrawal_approved_at   timestamptz;
```

### 흐름

```
회원: [탈퇴 신청] → withdrawal_status = 'pending'
                         ↓
관리자: AdminPage 승인대기 탭에 표시
         [승인] → withdrawal_status = 'approved', is_approved = false
         [거절] → withdrawal_status = 'none'
                         ↓
스케줄: 탈퇴 회원 배정 → line-through 표시
```

### 변경 파일

#### `src/pages/DashboardPage.tsx`
- 하단 또는 프로필 영역에 "조직 탈퇴 신청" 버튼 추가
- 클릭 → ConfirmDialog ("정말 탈퇴를 신청하시겠습니까?")
- 확인 시: `UPDATE tenant_memberships SET withdrawal_status='pending', withdrawal_requested_at=now()`
- 이미 신청한 경우: "탈퇴 신청 처리 중" 상태 표시

#### `src/pages/AdminPage.tsx`
- 승인대기 탭(Pending)에 기존 회원 가입 승인 외 **탈퇴 신청** 섹션 추가
- 탈퇴 신청 항목: 회원 이름, 신청일, [승인] [거절] 버튼
- 승인: `withdrawal_status='approved', withdrawal_approved_at=now(), is_approved=false`
- 거절: `withdrawal_status='none'`
- `useAdmin` 훅에서 `withdrawal_status='pending'` 인 membership도 fetch

#### `src/pages/SchedulePage.tsx`
```typescript
const withdrawnUserIds = new Set(
  memberships
    .filter(m => m.tenant_id === tenant?.id && m.withdrawal_status === 'approved')
    .map(m => m.user_id)
)
```
- `withdrawnUserIds`를 그리드 컴포넌트에 전달

#### 그리드/셀 컴포넌트
- `withdrawnUserIds: Set<string>` prop 추가
- 배정 렌더링 시 `withdrawnUserIds.has(assignment.user_id)` → `line-through opacity-50` 적용

#### `src/types/index.ts`
- `TenantMembership` 타입에 `withdrawal_status`, `withdrawal_requested_at`, `withdrawal_approved_at` 필드 추가

---

## Feature 5 — 자동배정 옵션

### 개요
관리자가 회원별 가능 요일·월별 횟수 제한을 설정하고, 역할별 배정 비율을 지정.  
자동배정 알고리즘이 이 제약을 반영하여 배정 후보를 계산.

### DB 마이그레이션 (migration `016_membership_extensions.sql`에 통합)
```sql
ALTER TABLE tenant_memberships
  ADD COLUMN IF NOT EXISTS available_days  int[]  DEFAULT NULL,
  -- null=모든 요일, [0,1,2,3,4,5,6] = 일월화수목금토
  ADD COLUMN IF NOT EXISTS monthly_limit   int    DEFAULT NULL;
  -- null=제한없음
```

역할 비율은 `tenants.settings.role_ratios: Record<string, number>` JSONB에 저장 (합계 100).

### 관리 UI

#### `src/pages/AdminPage.tsx` — 회원 탭
각 회원 행에 "설정" 버튼(또는 인라인 확장):
- **가능 요일**: 일/월/화/수/목/금/토 체크박스 (전체 선택 = null = 제한없음)
- **월별 횟수 제한**: 숫자 입력 (빈칸 = null = 무제한)
- 저장: `UPDATE tenant_memberships SET available_days=..., monthly_limit=...`

#### `src/pages/AdminPage.tsx` — 설정 탭
자동배정 역할 비율 섹션:
- 역할별 퍼센트 입력 (예: 자원봉사자 60% / 50플러스 40%)
- 합계가 100이 아니면 저장 불가
- 저장: `UPDATE tenants SET settings = settings || '{"role_ratios": {...}}'`

### `src/utils/autoAssign.ts` 변경

```typescript
interface MemberPreference {
  availableDays: number[] | null  // null = 모든 요일
  monthlyLimit:  number   | null  // null = 무제한
}

interface AutoAssignParams {
  // 기존 필드...
  memberPreferences?: Map<string, MemberPreference>  // userId → preference
  roleRatios?: Record<string, number>                // roleId → percent
}
```

**알고리즘 변경점:**

1. **가능 요일 필터**:
   ```typescript
   const dayOfWeek = new Date(year, month - 1, day).getDay()
   const eligible = members.filter(m => {
     const pref = memberPreferences?.get(m.id)
     return !pref?.availableDays || pref.availableDays.includes(dayOfWeek)
   })
   ```

2. **월별 횟수 제한 필터**:
   ```typescript
   const eligible2 = eligible.filter(m => {
     const pref = memberPreferences?.get(m.id)
     if (!pref?.monthlyLimit) return true
     return assignCountThisMonth[m.id] < pref.monthlyLimit
   })
   ```

3. **역할 비율 적용** (비split 모드, roleRatios 있을 때):
   - 전체 빈슬롯 수 × ratio 비율로 각 타입별 할당 수 계산
   - 할당 수를 초과하면 해당 타입 배정 중단

### `src/pages/SchedulePage.tsx`
`handleAutoAssign()` 에서 `memberPreferences`와 `roleRatios` 로드 후 `computeAutoAssignments`에 전달.

---

## DB 마이그레이션 파일 목록

| 파일 | 내용 |
|------|------|
| `016_membership_extensions.sql` | `tenant_memberships`에 `withdrawal_status`, `withdrawal_requested_at`, `withdrawal_approved_at`, `available_days`, `monthly_limit` 추가 |

---

## 영향 범위 요약

| 기능 | 변경 파일 |
|------|---------|
| F7 모드 정의 | `types/index.ts`, `TenantContext.tsx` |
| F7 모드 관리 | `SuperAdminPage.tsx` |
| F7 모드 적용 | `SchedulePage.tsx`, `SlotEditModal.tsx`, `ScheduleGrid.tsx`, `WeekGrid.tsx`, `DayView.tsx` |
| F8 탈퇴 신청 | `DashboardPage.tsx` |
| F8 탈퇴 승인 | `AdminPage.tsx`, `useAdmin.ts` |
| F8 탈퇴 표시 | `SchedulePage.tsx`, `TimeSlotCell.tsx` (또는 셀 렌더 담당 컴포넌트) |
| F5 선호 설정 UI | `AdminPage.tsx` |
| F5 알고리즘 | `autoAssign.ts`, `SchedulePage.tsx` |
| DB | `supabase/migrations/016_membership_extensions.sql` |
