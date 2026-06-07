# 파일 구조 & 화면 목록

> 화면 수정 시 이 목록에서 파일을 찾으세요.

---

## Pages (전체 화면)

| 파일 | URL | 화면 설명 | 진입 조건 |
|------|-----|----------|----------|
| `src/pages/LandingPage.tsx` | `/` | 서비스 소개 랜딩 + 스케줄 애니메이션 | 비로그인 |
| `src/pages/ConsentPage.tsx` | `/consent` | 이용약관·개인정보 동의 | 비로그인 |
| `src/pages/AuthPage.tsx` | `/auth` | 로그인 / 이메일·소셜 회원가입 위저드 | 비로그인 |
| `src/pages/PendingPage.tsx` | `*` | 가입 방법 선택 / 조직 신청 / 승인 대기 | 로그인 + 미소속 |
| `src/pages/SchedulePage.tsx` | `/schedule` | 메인 스케줄 편집 화면 | 로그인 + 소속 |
| `src/pages/DashboardPage.tsx` | `/dashboard` | 통계·현황 대시보드 | 로그인 + 소속 |
| `src/pages/AdminPage.tsx` | `/admin` | 조직 관리 (멤버·역할·설정) | 조직 관리자 |
| `src/pages/CustomerAdminPage.tsx` | `/customer-admin` | 서비스 관리 (조직 생성·플랜) | 서비스 오너 |
| `src/pages/TenantSelectPage.tsx` | `/select-org` | 조직 선택 (복수 소속 시) | 로그인 + 다중 소속 |
| `src/pages/SuperAdminPage.tsx` | `/superadmin` | 전체 서비스 관리 | 슈퍼어드민 |
| `src/pages/SharePage.tsx` | `/share` | 스케줄 공개 공유 뷰 | 누구나 |

---

## Components — 공통 레이아웃

| 파일 | 사용 위치 | 역할 |
|------|----------|------|
| `src/components/auth/ScheduleBackground.tsx` | Auth·Consent·Pending | 캘린더 배경 + 브랜드 바 + 네비 슬롯 |
| `src/components/AppHeader.tsx` | Schedule·Dashboard·Admin | 상단 헤더 (메뉴·필터·유저) |
| `src/components/DashboardNav.tsx` | Dashboard | 대시보드 네비게이션 |

---

## Components — 모달 / 팝업

| 파일 | 노출 위치 | 역할 |
|------|----------|------|
| `src/components/auth/LoginModal.tsx` | 앱 내부 재인증 필요 시 | 로그인 팝업 (소셜+이메일) |
| `src/components/auth/ProfileModal.tsx` | 헤더 프로필 클릭 | 계정 정보·소셜 연동·로그아웃 |
| `src/components/modals/JoinOrgModal.tsx` | 조직 전환 시 | 조직 가입 신청 모달 |
| `src/components/modals/SlotEditModal.tsx` | 스케줄 셀 클릭 | 시간 슬롯 편집 |
| `src/components/modals/RecurringModal.tsx` | 반복 설정 버튼 | 반복 규칙 편집 |
| `src/components/modals/CapacityModal.tsx` | 정원 설정 버튼 | 슬롯 정원 편집 |
| `src/components/modals/HolidayNoteModal.tsx` | 공휴일 클릭 | 공휴일 노트 편집 |
| `src/components/modals/AutoAssignPreviewModal.tsx` | 자동 배정 버튼 | 자동 배정 미리보기·확정 |
| `src/components/shared/ConfirmDialog.tsx` | 전체 | 삭제·확인 다이얼로그 |
| `src/components/shared/ExportButton.tsx` | 스케줄·대시보드 | 엑셀/CSV 내보내기 버튼 |
| `src/components/shared/FilterBar.tsx` | 스케줄 | 멤버·날짜 필터 바 |
| `src/components/shared/SlotEditor.tsx` | AdminPage | 시간 슬롯 규칙 편집기 |

---

## Components — 스케줄 뷰

| 파일 | 역할 |
|------|------|
| `src/components/schedule/ScheduleHeader.tsx` | 주간 날짜 헤더 |
| `src/components/schedule/DayView.tsx` | 1일 세로 타임라인 뷰 |
| `src/components/schedule/MobileScheduleView.tsx` | 모바일 스케줄 뷰 |
| `src/components/schedule/TimeSlotCell.tsx` | 개별 시간 슬롯 셀 |

---

## Contexts / Hooks / Utils

| 파일 | 역할 |
|------|------|
| `src/contexts/AuthContext.tsx` | 로그인·세션·signUp/signIn 전역 상태 |
| `src/contexts/TenantContext.tsx` | 현재 조직·멤버십 전역 상태 |
| `src/hooks/useAuth.ts` | AuthContext 접근 훅 |
| `src/hooks/useAdmin.ts` | 조직 관리자 권한·데이터 훅 |
| `src/hooks/useCustomerAdmin.ts` | 서비스 오너 데이터 훅 |
| `src/hooks/useSchedule.ts` | 스케줄 CRUD 훅 |
| `src/hooks/useProfiles.ts` | 멤버 프로필 목록 훅 |
| `src/hooks/useTenantRoles.ts` | 조직 역할 목록 훅 |
| `src/hooks/useRealtime.ts` | Supabase Realtime 구독 훅 |
| `src/hooks/useDarkMode.ts` | 다크모드 토글 훅 |
| `src/utils/autoAssign.ts` | 자동 배정 알고리즘 |
| `src/utils/cellState.ts` | 셀 상태 계산 |
| `src/utils/timeSlots.ts` | 시간 슬롯 유틸 |
| `src/utils/koreanHolidays.ts` | 공휴일 데이터 |
| `src/utils/recurringDates.ts` | 반복 날짜 계산 |
| `src/lib/supabase.ts` | Supabase 클라이언트 초기화 |
| `src/types/index.ts` | 전체 타입 정의 |

---

## 라우팅 분기 (App.tsx)

```
비로그인
  /            → LandingPage
  /consent     → ConsentPage
  /auth        → AuthPage
  /share       → SharePage
  *            → LandingPage (redirect)

로그인 + 미소속 (PendingPage 분기)
  *            → PendingPage
  /superadmin  → SuperAdminPage
  /share       → SharePage

로그인 + 서비스오너만 (CustomerAdmin 분기)
  *            → CustomerAdminPage
  /customer-admin → CustomerAdminPage
  /share       → SharePage

로그인 + 소속 (일반 멤버)
  /            → SchedulePage (기본)
  /schedule    → SchedulePage
  /dashboard   → DashboardPage
  /admin       → AdminPage
  /customer-admin → CustomerAdminPage
  /select-org  → TenantSelectPage
  /superadmin  → SuperAdminPage
  /share       → SharePage
```

---

## 스타일 파일

| 파일 | 역할 |
|------|------|
| `src/index.css` | 전역 CSS (Tailwind import, 디자인 토큰) |
| `src/styles/tokens.css` | 색상·간격 CSS 변수 |
| `src/styles/auth-design.css` | Auth·Consent·Pending 화면 디자인 시스템 |
