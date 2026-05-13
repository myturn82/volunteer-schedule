# Figma Tokens Studio 설정 가이드

Figma에서 디자인 토큰을 수정하면 이 앱의 색상이 자동으로 업데이트됩니다.

---

## 1. Figma 플러그인 설치

1. Figma 열기 → 상단 메뉴 → **Plugins** → **Browse plugins in Community**
2. **"Tokens Studio for Figma"** 검색 → Install
3. **"Locofy.ai"** 검색 → Install *(새 컴포넌트 코드 생성용)*

---

## 2. Tokens Studio GitHub 연동

1. Figma에서 **Tokens Studio** 플러그인 실행
2. 왼쪽 메뉴 → **Sync** → **GitHub** 선택
3. 아래 정보 입력:
   - **Personal Access Token**: [GitHub Settings → Developer settings → Personal access tokens → New token](https://github.com/settings/tokens) → `repo` 권한 선택 후 생성
   - **Repository**: `myturn82/volunteer-schedule`
   - **Branch**: `master`
   - **File path**: `tokens.json`
4. **Save** 클릭 후 기존 `tokens.json` Pull

---

## 3. 디자인 토큰 수정하기

### 색상 변경 예시: 밤타임 셀 색상 바꾸기

1. Tokens Studio에서 **`color` → `schedule` → `night`** 클릭
2. 원하는 색상 값으로 수정 (예: `#fff0f0`)
3. 상단 **Push to GitHub** 버튼 클릭
4. GitHub Actions 자동 실행 (약 1분 소요)
5. 로컬에서 `git pull && npm run dev` → 브라우저에서 색상 변경 확인

### Vercel 자동 배포

- `tokens.json`이 GitHub에 Push되면 Vercel이 자동으로 `npm run build`를 실행
- `prebuild` 스크립트가 `tokens.css`를 재생성 후 배포

---

## 4. 현재 토큰 목록

| 토큰 경로 | 현재 값 | Tailwind 클래스 | 용도 |
|-----------|---------|-----------------|------|
| `color.schedule.night` | `#fdf2f8` | `bg-schedule-night` | 밤타임(18-22시) 셀 |
| `color.schedule.night-hover` | `#fce7f3` | `hover:bg-schedule-night-hover` | 밤타임 셀 hover |
| `color.schedule.saturday` | `#fefce8` | `bg-schedule-saturday` | 토요일 운영 셀 |
| `color.schedule.saturday-hover` | `#fef9c3` | `hover:bg-schedule-saturday-hover` | 토요일 셀 hover |
| `color.schedule.close` | `#e5e7eb` | `bg-schedule-close` | CLOSE/휴관 셀 |
| `color.schedule.breaktime` | `#f3f4f6` | `bg-schedule-breaktime` | BREAKTIME 셀 |
| `color.schedule.highlight` | `#fef08a` | `bg-schedule-highlight` | 이름 검색 하이라이트 |
| `color.brand.primary` | `#2563eb` | `bg-brand-primary` | 로그인 버튼 등 |

---

## 5. 새 컴포넌트 생성하기 (Locofy.ai)

1. Figma에서 새 화면/컴포넌트 디자인
2. **Locofy.ai** 플러그인 실행 → 컴포넌트 선택 → **Export** → React + Tailwind CSS 선택
3. 생성된 코드를 `src/components/` 아래에 복사
4. TypeScript 타입 추가 및 Supabase 훅 연결은 수동 작업

---

## 6. 로컬 개발 팁

```bash
# tokens.json 수정 후 즉시 반영
npm run build:tokens

# 개발 서버 시작 (자동으로 build:tokens 먼저 실행)
npm run dev
```


