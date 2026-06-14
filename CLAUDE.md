# dtschedule 프로젝트 규칙

## 새 PC / 환경 최초 설정 체크리스트

새 PC에서 프로젝트를 처음 시작하거나 유사한 프로젝트를 구성할 때 반드시 아래를 순서대로 수행한다.

### 1. 저장소 클론 및 의존성 설치

```
git clone <repo-url>
cd <project-dir>
npm install
```

### 2. 환경 변수 설정

`.env.local` 파일을 프로젝트 루트에 생성하고 Supabase 대시보드에서 값을 복사한다.

```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
```

- Supabase 대시보드 → Project Settings → API 에서 확인
- `.env.local`은 `.gitignore`에 포함되어 있으므로 직접 생성해야 한다

### 3. Supabase CLI 인증

터미널이 non-TTY 환경(Claude Code 등)일 경우 대화형 로그인이 안 되므로
Personal Access Token을 발급받아 사용한다.

**토큰 발급:** https://supabase.com/dashboard/account/tokens

```
npx supabase login --token <your-personal-access-token>
```

- 토큰은 PC마다 1개씩 발급하거나 동일 토큰을 여러 PC에서 공유해도 무방하다
- 로그인 후 토큰은 `%APPDATA%\supabase\access-token`에 저장되어 이후 자동 인증된다
- 토큰 분실 또는 PC 폐기 시 대시보드에서 해당 토큰만 revoke한다

### 4. 개발 서버 실행 확인

```
npm run dev
```

`http://localhost:5173` 에서 정상 동작 확인

### 5. (Supabase 프로젝트가 새로운 경우) DB 스키마 초기화

새 Supabase 프로젝트에 스키마를 처음 구성할 때:
- `supabase/reset_db.sql` 내용을 Supabase SQL Editor에서 실행
- 이후 슈퍼어드민 계정 지정: `UPDATE profiles SET is_super_admin = true WHERE email = '...';`

---

## DB 환경 구성

| 환경 | Supabase Project ID |
|------|---------------------|
| 개발 (dev) | `mcuszdvophmqrwostcah` |
| 운영 (prod) | `bjnmaajhcmhxwonybnqc` |

## DB 변경 워크플로우

테이블·컬럼 추가/삭제/수정 등 스키마 변경이 필요한 경우 반드시 아래 순서를 따른다.

### 1단계 — 개발 DB에 먼저 반영

- 마이그레이션 파일을 `supabase/migrations/`에 작성한다.
- 개발 DB(`mcuszdvophmqrwostcah`)에 적용하고 기능을 검증한다.
  ```
  npx supabase db push --project-ref mcuszdvophmqrwostcah
  ```

### 2단계 — 사용자 승인 후 운영 반영

- 개발 DB에서 테스트가 완료되면 사용자에게 운영 반영 여부를 확인한다.
- **명시적인 승인 없이는 운영 DB(`bjnmaajhcmhxwonybnqc`)에 절대 적용하지 않는다.**
- 승인이 확인되면 운영 DB에 적용한다.
  ```
  npx supabase db push --project-ref bjnmaajhcmhxwonybnqc
  ```

### 3단계 — 초기화 파일 갱신

운영 DB 반영 완료 후 `supabase/CLAUDE.md`의 규칙에 따라
`supabase/reset_db.sql`과 `supabase/reset_data.sql`을 최신 상태로 갱신한다.

## 요약 원칙

- 개발 → 검증 → 사용자 승인 → 운영 순서를 반드시 지킨다.
- 운영 DB 직접 수정은 금지한다. 항상 마이그레이션 파일을 통해 변경한다.
- 승인 없는 운영 배포는 커밋·배포와 동일하게 금지된다.

## 변경사항 점검 체크리스트

기능 추가/수정 작업을 완료하면 `docs/CHANGE_TEST_CHECKLIST_TEMPLATE.md`를 기준으로
`docs/checklist_YYYY-MM-DD.md` 파일을 작성하여 사용자가 직접 동작을 점검할 수 있도록 한다.

## 스케줄 화면(월/주/일 뷰) 동일 적용 규칙

스케줄 표시·동작에 영향을 주는 변경(셀 상태 표시, 잠금/휴관 등 뱃지·아이콘, 클릭 동작, 권한별 노출 등)을
작업할 때는 월간 뷰(`ScheduleGrid`/`TimeSlotCell`), 주간 뷰(`WeekGrid`), 일간 뷰(`DayView`),
모바일 뷰(`MobileScheduleView`) 중 어디서 시작했든 **나머지 뷰에도 동일하게 적용되었는지 반드시 함께 확인**한다.

- 각 뷰는 렌더링 코드가 별도로 분리되어 있어(`WeekGrid`/`DayView`는 `TimeSlotCell`을 사용하지 않고 자체 렌더링),
  한 곳만 수정하면 다른 뷰에서는 누락되기 쉽다.
- `getCellState()`가 반환하는 `CellState`의 필드(예: `isLocked`)를 활용하는 변경이라면,
  주간 뷰처럼 인접 월의 데이터를 함께 보여주는 화면에서는 해당 월의 `dateOverrides`/`assignments`가
  올바르게 병합되어 전달되는지도 확인한다.
- 작업 완료 후 점검 체크리스트(`docs/checklist_YYYY-MM-DD.md`)에도 월/주/일 뷰 각각에 대한 확인 항목을 포함한다.

## 다이나믹 구현 원칙 (하드코딩 금지)

이 시스템의 핵심은 **조직(tenant)마다 설정이 다른 멀티테넌트 구조**다.
역할 이름, 타입 라벨, 슬롯 설정, 테마 색상 등 모든 표시 값은 조직 설정에서 읽어야 하며,
특정 조직의 값을 소스코드에 하드코딩해서는 절대 안 된다.

### 반드시 지켜야 할 규칙

1. **라벨·명칭 하드코딩 금지**
   - `member_label`, `plus_label`, `role.name` 등 표시 문자열은 반드시 DB/설정에서 읽는다.
   - 폴백(fallback) 기본값도 특정 조직의 명칭이 아닌, 빈 문자열(`''`) 또는 완전히 중립적인 값만 허용.
   - 폴백이 빈 문자열이면 해당 기능/탭/버튼을 **숨기거나 비활성화**한다(미설정 조직에서 불필요한 UI 노출 방지).

2. **역할(role) 기반 로직은 항상 동적으로**
   - `splitRoles`, `tenantRoles`, `ROLE_TINTS` 등은 조직 설정에서 주입된 값을 사용한다.
   - 역할 개수·이름·색상을 코드에 고정하지 않는다.

3. **조직 설정 경로**
   - 조직 설정: `tenant.settings` (JSONB) — `volunteer_label`, `plus_label`, `theme_color`, `open_from`, `open_to` 등
   - 역할 목록: `tenantRoles` (`tenant_roles` 테이블)
   - 슬롯 설정: `slotSettings`, `scheduleRules`, `dateOverrides`
   - 이 값들은 `TenantContext`를 통해 컴포넌트에 주입한다.

4. **신규 기능 구현 시 체크리스트**
   - [ ] 표시 문자열이 조직 설정에서 오는가?
   - [ ] 역할/타입 목록이 DB에서 동적으로 로드되는가?
   - [ ] 특정 조직 이름·값이 소스코드 어디에도 없는가?
   - [ ] 미설정 조직에서도 UI가 깨지지 않는가?

---

## 아이콘 사용 원칙 (시스템 이모지 기준)

이 사이트의 아이콘 표준은 **시스템 이모지(System Emoji)** 다.
별도 이모지 폰트를 지정하지 않으므로 OS/브라우저 기본 이모지(Windows: Segoe UI Emoji, macOS/iOS: Apple Color Emoji, Android: Noto Color Emoji)로 렌더링된다.

### 반드시 지켜야 할 규칙

1. **UI 아이콘에 이모지 사용** — 버튼·셀·뱃지 등 UI 요소의 아이콘은 이모지를 사용한다.
   - 단, 크기·레이아웃 제어가 세밀하게 필요한 곳(예: 잠금 아이콘)은 SVG 인라인 아이콘 허용.

2. **이모지에 CSS `color` 금지** — 이모지는 시스템이 색상을 제어하므로 `color` / `fill` 속성을 적용해도 무효다. 이모지 색상을 CSS로 바꾸려 하지 않는다.

3. **이모지 크기는 `text-sm` 이상** — `text-[10px]` 등 지나치게 작은 크기는 이모지가 뭉개진다. 캘린더 셀처럼 공간이 좁은 곳도 최소 `text-sm`(14px)으로 지정한다.

4. **`select-none` 추가** — 이모지를 UI 아이콘으로 사용할 때는 `select-none` 클래스를 붙여 텍스트 선택을 방지한다.

---

## Supabase Realtime 구독 원칙

실시간 구독을 잘못 설계하면 메시지 수가 폭발해 비용이 급증한다.
새 테이블에 구독을 추가하거나 기존 구독을 수정할 때 반드시 아래 기준을 따른다.

> 상세 현황: `docs/realtime-subscription-status.md`

### 필수 규칙

1. **언마운트 시 구독 해제** — `useEffect` cleanup에서 반드시 `supabase.removeChannel(channel)` 호출.

2. **tenant_id 필터 필수** — 테이블 전체를 구독하면 다른 조직 이벤트까지 수신해 메시지 비용이 폭발한다.
   INSERT·UPDATE·DELETE 모두 `filter: \`tenant_id=eq.${tenantId}\`` 를 설정한다.

3. **DELETE 필터를 쓰려면 REPLICA IDENTITY FULL 필수**
   - DEFAULT replica identity에서 DELETE `payload.old`에는 PK(`id`)만 포함된다.
   - `tenant_id` 등 비PK 컬럼으로 필터를 걸면 서버가 이벤트 자체를 전달하지 않는다.
   - DELETE에도 filter를 걸어야 하는 테이블은 반드시 아래 SQL을 마이그레이션에 포함한다:
     ```sql
     ALTER TABLE <table_name> REPLICA IDENTITY FULL;
     ```

4. **새 테이블 추가 시 두 SQL 모두 필요**
   ```sql
   ALTER TABLE <table_name> REPLICA IDENTITY FULL;          -- DELETE 필터 지원
   ALTER PUBLICATION supabase_realtime ADD TABLE <table_name>;
   ```

5. **고빈도 데이터는 Broadcast 사용** — 1초에 수십 번 변경되는 데이터(커서, 센서 등)는
   `postgres_changes`(CDC) 대신 Supabase Broadcast를 사용한다. DB 부하와 메시지 비용이 모두 절감된다.

### 구독 패턴 (표준 코드)

```typescript
useEffect(() => {
  if (!tenantId) return
  const channel = supabase
    .channel(`<table>-${tenantId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: '<table>', filter: `tenant_id=eq.${tenantId}` }, handler)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: '<table>', filter: `tenant_id=eq.${tenantId}` }, handler)
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: '<table>', filter: `tenant_id=eq.${tenantId}` }, handler)
    .subscribe()
  return () => { supabase.removeChannel(channel) }   // ← 언마운트 해제 필수
}, [tenantId])
```

---

## 타입 체크 명령어

루트에서 실행하는 `npx tsc --noEmit`은 루트 `tsconfig.json`(`files: []`, project reference만 있음) 기준으로 동작해
실제로는 아무 파일도 검사하지 않고 항상 통과한다. **타입 체크는 반드시 `npx tsc -b`
(또는 `npm run build`)로 확인**한다. 실제 빌드(`tsc -b && vite build`)와 동일한 결과를 보장한다.
