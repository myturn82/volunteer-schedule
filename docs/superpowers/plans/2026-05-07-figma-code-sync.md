# Figma ↔ 코드 디자인 토큰 동기화 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Figma의 Tokens Studio 플러그인에서 디자인 토큰을 변경하면 `tokens.json` → Style Dictionary → `src/styles/tokens.css` → Tailwind v4 파이프라인을 통해 앱 색상이 자동 반영되도록 인프라 구축

**Architecture:** Style Dictionary가 `tokens.json`을 CSS 변수로 변환 → Tailwind v4 `@theme` 블록이 CSS 변수를 Tailwind 클래스로 노출 → `predev`/`prebuild` npm 스크립트가 빌드 시 자동 실행. GitHub Actions는 `tokens.json` 변경 시 자동 검증.

**Tech Stack:** style-dictionary v3, Tailwind CSS v4, GitHub Actions, Figma Tokens Studio 플러그인

---

## 파일 구조

```
d:/claudePrj/volunteer-schedule/
├── tokens.json                           # Tokens Studio가 관리하는 소스 토큰
├── style-dictionary.config.js            # Style Dictionary 변환 규칙
├── src/
│   ├── styles/
│   │   └── tokens.css                    # 자동 생성 CSS 변수 (gitignore)
│   ├── index.css                         # tokens.css import + @theme 추가
│   └── components/schedule/
│       └── TimeSlotCell.tsx              # 토큰 기반 Tailwind 클래스 사용 예시
├── .gitignore                            # src/styles/tokens.css 추가
└── .github/workflows/tokens.yml         # tokens.json 변경 시 자동 검증
```

---

## Task 1: Style Dictionary 설치 및 설정

**Files:**
- Modify: `package.json`
- Create: `style-dictionary.config.js`

- [ ] **Step 1: style-dictionary 설치**

```bash
cd d:/claudePrj/volunteer-schedule
npm install -D style-dictionary
```
Expected: `node_modules/style-dictionary` 생성

- [ ] **Step 2: package.json scripts 추가**

`package.json`의 `"scripts"` 블록을 다음으로 수정:

```json
"scripts": {
  "dev": "vite",
  "predev": "npm run build:tokens",
  "build": "tsc -b && vite build",
  "prebuild": "npm run build:tokens",
  "build:tokens": "style-dictionary build",
  "lint": "eslint .",
  "preview": "vite preview",
  "test": "vitest"
}
```

- [ ] **Step 3: style-dictionary.config.js 생성**

```javascript
// style-dictionary.config.js
const { mkdir } = require('fs/promises')
const path = require('path')

module.exports = {
  source: ['tokens.json'],
  platforms: {
    css: {
      transformGroup: 'css',
      buildPath: 'src/styles/',
      files: [
        {
          destination: 'tokens.css',
          format: 'css/variables',
          options: {
            selector: ':root',
            outputReferences: false,
          },
        },
      ],
    },
  },
}
```

- [ ] **Step 4: Commit**

```bash
git add package.json style-dictionary.config.js package-lock.json
git commit -m "feat: install style-dictionary and configure token pipeline"
```

---

## Task 2: tokens.json 초기값 설정

**Files:**
- Create: `tokens.json`

- [ ] **Step 1: tokens.json 생성 (현재 앱 색상 기준)**

```json
{
  "color": {
    "schedule": {
      "night": {
        "value": "#fdf2f8",
        "comment": "밤타임(18-22시) 셀 배경"
      },
      "night-hover": {
        "value": "#fce7f3",
        "comment": "밤타임 셀 hover"
      },
      "saturday": {
        "value": "#fefce8",
        "comment": "토요일 운영 셀 배경"
      },
      "saturday-hover": {
        "value": "#fef9c3",
        "comment": "토요일 셀 hover"
      },
      "close": {
        "value": "#e5e7eb",
        "comment": "CLOSE/휴관 셀 배경"
      },
      "breaktime": {
        "value": "#f3f4f6",
        "comment": "BREAKTIME 셀 배경"
      },
      "highlight": {
        "value": "#fef08a",
        "comment": "이름 검색 하이라이트"
      }
    },
    "brand": {
      "primary": {
        "value": "#2563eb",
        "comment": "주요 버튼, 링크 색상"
      },
      "primary-hover": {
        "value": "#1d4ed8",
        "comment": "주요 버튼 hover"
      }
    }
  },
  "spacing": {
    "cell-min-height": {
      "value": "2.5rem",
      "comment": "스케줄 셀 최소 높이"
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add tokens.json
git commit -m "feat: add initial design tokens matching current app"
```

---

## Task 3: Style Dictionary 실행 및 tokens.css 검증

**Files:**
- Create: `src/styles/tokens.css` (자동 생성)
- Modify: `.gitignore`

- [ ] **Step 1: src/styles 디렉토리 생성 후 build:tokens 실행**

```bash
mkdir -p d:/claudePrj/volunteer-schedule/src/styles
cd d:/claudePrj/volunteer-schedule && npm run build:tokens
```
Expected 출력:
```
style-dictionary build

css
✔︎ src/styles/tokens.css
```

- [ ] **Step 2: 생성된 tokens.css 내용 확인**

```bash
cat d:/claudePrj/volunteer-schedule/src/styles/tokens.css
```
Expected:
```css
/**
 * Do not edit directly, this file was auto-generated.
 */

:root {
  --color-schedule-night: #fdf2f8;
  --color-schedule-night-hover: #fce7f3;
  --color-schedule-saturday: #fefce8;
  --color-schedule-saturday-hover: #fef9c3;
  --color-schedule-close: #e5e7eb;
  --color-schedule-breaktime: #f3f4f6;
  --color-schedule-highlight: #fef08a;
  --color-brand-primary: #2563eb;
  --color-brand-primary-hover: #1d4ed8;
  --spacing-cell-min-height: 2.5rem;
}
```

- [ ] **Step 3: .gitignore에 tokens.css 추가**

`.gitignore` 파일에 다음 줄 추가:
```
src/styles/tokens.css
```

- [ ] **Step 4: Commit**

```bash
git add .gitignore
git commit -m "feat: generate tokens.css from tokens.json, gitignore generated file"
```

---

## Task 4: index.css에 토큰 통합

**Files:**
- Modify: `src/index.css`

- [ ] **Step 1: index.css 수정**

현재 내용을 다음으로 교체:

```css
@import "tailwindcss";
@import "./styles/tokens.css";
@variant dark (&:where(.dark, .dark *));

@theme {
  --color-schedule-night: var(--color-schedule-night);
  --color-schedule-night-hover: var(--color-schedule-night-hover);
  --color-schedule-saturday: var(--color-schedule-saturday);
  --color-schedule-saturday-hover: var(--color-schedule-saturday-hover);
  --color-schedule-close: var(--color-schedule-close);
  --color-schedule-breaktime: var(--color-schedule-breaktime);
  --color-schedule-highlight: var(--color-schedule-highlight);
  --color-brand-primary: var(--color-brand-primary);
  --color-brand-primary-hover: var(--color-brand-primary-hover);
  --spacing-cell-min-height: var(--spacing-cell-min-height);
}
```

- [ ] **Step 2: 빌드 확인**

```bash
cd d:/claudePrj/volunteer-schedule && npm run build
```
Expected: `✓ built in` 메시지, 오류 없음

- [ ] **Step 3: Commit**

```bash
git add src/index.css
git commit -m "feat: import tokens.css and expose as Tailwind theme tokens"
```

---

## Task 5: TimeSlotCell.tsx 토큰 기반 클래스로 업데이트

**Files:**
- Modify: `src/components/schedule/TimeSlotCell.tsx`

이 작업은 토큰 파이프라인이 실제로 작동함을 증명하는 예시입니다.  
`bg-pink-50` 같은 하드코딩된 색상을 토큰 기반 클래스로 교체합니다.

- [ ] **Step 1: TimeSlotCell.tsx 수정**

`src/components/schedule/TimeSlotCell.tsx`의 `bgClass` 부분을 다음으로 교체:

```typescript
const bgClass = isNightShift
  ? 'bg-schedule-night dark:bg-pink-950 hover:bg-schedule-night-hover dark:hover:bg-pink-900'
  : isSaturdayShift
  ? 'bg-schedule-saturday dark:bg-yellow-950 hover:bg-schedule-saturday-hover dark:hover:bg-yellow-900'
  : 'bg-white dark:bg-gray-800 hover:bg-blue-50 dark:hover:bg-blue-950'
```

BREAKTIME 셀 div:
```tsx
<div className="min-h-[2.5rem] bg-schedule-breaktime dark:bg-gray-700 flex items-center justify-center text-xs text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-600">
  BREAKTIME
</div>
```

CLOSE 셀 div:
```tsx
<div className="min-h-[2.5rem] bg-schedule-close dark:bg-gray-600 flex items-center justify-center text-xs text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-600">
  {isHoliday ? '휴관' : 'CLOSE'}
</div>
```

하이라이트 span:
```tsx
className={`text-xs truncate dark:text-gray-200 ${highlightName && a.volunteer_name.includes(highlightName) ? 'bg-schedule-highlight dark:bg-yellow-700 font-bold rounded px-0.5' : ''}`}
```

- [ ] **Step 2: 빌드 확인**

```bash
cd d:/claudePrj/volunteer-schedule && npm run build
```
Expected: 오류 없음

- [ ] **Step 3: 테스트 실행**

```bash
npm test -- --run
```
Expected: 18/18 PASS

- [ ] **Step 4: 토큰 변경 → 반영 확인 (수동 검증)**

`tokens.json`의 `color.schedule.night.value`를 `"#fff0f0"`으로 임시 변경:

```bash
npm run build:tokens && npm run dev
```

브라우저에서 밤타임 셀 색상이 바뀌는지 확인. 확인 후 원래 값 `"#fdf2f8"`으로 복원.

- [ ] **Step 5: Commit**

```bash
git add src/components/schedule/TimeSlotCell.tsx tokens.json
git commit -m "feat: use design token classes in TimeSlotCell"
```

---

## Task 6: GitHub Actions 토큰 검증 워크플로우

**Files:**
- Create: `.github/workflows/tokens.yml`

`tokens.json` 변경 시 Style Dictionary를 실행하여 `tokens.css`가 최신인지 검증합니다.

- [ ] **Step 1: .github/workflows/tokens.yml 생성**

```yaml
# .github/workflows/tokens.yml
name: Validate Design Tokens

on:
  push:
    paths:
      - 'tokens.json'
  pull_request:
    paths:
      - 'tokens.json'

jobs:
  validate-tokens:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - run: npm ci

      - name: Build tokens
        run: npm run build:tokens

      - name: Show generated tokens
        run: cat src/styles/tokens.css
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/tokens.yml
git commit -m "ci: add GitHub Actions workflow to validate design tokens"
```

---

## Task 7: Figma Tokens Studio 설정 가이드

**Files:**
- Create: `docs/figma-setup.md`

- [ ] **Step 1: figma-setup.md 작성**

```markdown
# Figma Tokens Studio 설정 가이드

## 1. Figma 플러그인 설치

1. Figma 열기 → 메뉴 → Plugins → Browse plugins in Community
2. "Tokens Studio for Figma" 검색 → Install
3. "Locofy.ai" 검색 → Install (새 컴포넌트 코드 생성용)

## 2. Tokens Studio GitHub 연동

1. Figma에서 Tokens Studio 플러그인 실행
2. 왼쪽 메뉴 → **Sync** → **GitHub** 선택
3. 설정 입력:
   - **Personal Access Token**: GitHub Settings → Developer settings → Personal access tokens → `repo` 권한으로 생성
   - **Repository**: `myturn82/volunteer-schedule`
   - **Branch**: `master`
   - **File path**: `tokens.json`
4. **Save** 클릭

## 3. 디자인 토큰 수정하기

1. Tokens Studio에서 토큰 값 수정 (예: `color.schedule.night` 색상 변경)
2. 상단 **Push to GitHub** 버튼 클릭
3. GitHub Actions 자동 실행 (tokens.json 변경 감지)
4. 로컬에서 `git pull` 후 `npm run dev` → 색상 변경 확인

## 4. 새 컴포넌트 생성하기 (Locofy.ai)

1. Figma에서 새 화면/컴포넌트 디자인
2. Locofy 플러그인 → 컴포넌트 선택 → **Export** → React + Tailwind
3. 생성된 코드를 `src/components/` 아래에 복사
4. TypeScript 타입, Supabase 훅 연결은 수동 작업

## 5. 현재 토큰 목록

| 토큰 이름 | 현재 값 | 용도 |
|-----------|---------|------|
| `color.schedule.night` | `#fdf2f8` | 밤타임(18-22시) 셀 배경 |
| `color.schedule.saturday` | `#fefce8` | 토요일 운영 셀 배경 |
| `color.schedule.close` | `#e5e7eb` | CLOSE/휴관 셀 배경 |
| `color.schedule.breaktime` | `#f3f4f6` | BREAKTIME 셀 배경 |
| `color.schedule.highlight` | `#fef08a` | 이름 검색 하이라이트 |
| `color.brand.primary` | `#2563eb` | 주요 버튼, 링크 |
```

- [ ] **Step 2: Commit and push**

```bash
git add docs/figma-setup.md
git commit -m "docs: add Figma Tokens Studio setup guide"
git push origin master
```

---

## 전체 검증

- [ ] `npm run dev` → 브라우저에서 정상 동작 확인
- [ ] `tokens.json` 색상 값 변경 → `npm run build:tokens && npm run dev` → 색상 변경 반영 확인
- [ ] `git push origin master` → GitHub Actions 실행 확인 (GitHub Actions 탭)
- [ ] Vercel 배포 후 `https://volunteer-schedule.vercel.app` 에서 색상 확인
