# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

**수입정산 매니저** — 영문 수입신고필증(PDF 스캔)과 한글 입고현황(xlsx)을 Claude AI로 자동 매칭하고 부대비용을 품목별로 안분하여 이카운트 ERP 업로드 양식(24컬럼 xlsx)을 자동 완성하는 Next.js 15 + Supabase 풀스택 웹 애플리케이션. 중소 무역·유통사 회계 담당자의 수작업 대조·계산·기입을 제거하는 것이 목표.

현재 코드베이스는 **Supabase 인증이 구현된 스타터 상태**이며, 업무 기능(파일 업로드·OCR·매칭·안분·환율·양식 생성)은 아직 미구현이다. 개발 착수 전 반드시 다음 문서를 확인할 것:

- **`docs/PRD.md`** — MVP 기능 명세(F001~F022), 데이터 모델(8개 테이블), Route Handler 설계, 수용 기준(AC-01~06)
- **`docs/ROADMAP.md`** — Phase 1-A~1-E, Task 001~020 단위 개발 순서·의존성·완료 기준
- **`docs/guides/`** — Next.js 15·폼·스타일링·컴포넌트 패턴 상세 가이드

## 개발 명령어

```bash
# 개발
npm run dev            # 개발 서버 (Turbopack)
npm run build          # 프로덕션 빌드
npm run check-all      # typecheck + lint + format:check 통합 (작업 완료 전 필수)

# 개별 검사
npm run typecheck      # tsc --noEmit (strict + noUnusedLocals/Parameters)
npm run lint:fix       # ESLint 자동 수정
npm run format         # Prettier 포맷팅

# E2E 테스트 (Playwright, testDir: ./e2e — 아직 테스트 없음)
npm run test:e2e               # 전체 실행 (webServer가 npm run dev 자동 기동)
npm run test:e2e -- foo.spec.ts            # 단일 파일 실행
npm run test:e2e -- -g "로그인"            # 제목으로 단일 테스트 필터
npm run test:e2e:headed        # 브라우저 표시하며 실행
npm run test:e2e:ui            # Playwright UI 모드
npm run test:e2e:report        # 마지막 HTML 리포트 열기

# Supabase 타입 생성 (DB 스키마 → lib/supabase/database.types.ts)
npm run db:types       # 원격 프로젝트 ($SUPABASE_PROJECT_ID 필요)
npm run db:types:local # 로컬 Supabase

# shadcn/ui 컴포넌트 추가
npx shadcn@latest add [component-name]
```

> **작업 완료 체크리스트**: `npm run check-all` + `npm run build` 통과 확인. API·비즈니스 로직 구현 시 ROADMAP의 각 Task 내 Playwright 테스트 체크리스트 수행.

## 아키텍처

### 디렉터리 구조 (플랫 — `src/` 없음)

경로 별칭 `@/*`는 **프로젝트 루트**(`./*`)로 매핑된다. `app/`·`components/`·`lib/`는 루트 직속이다.

```
app/              # Next.js App Router (페이지 + Route Handler + Server Action)
  actions/        # Server Actions ("use server")
  auth/           # 인증 페이지 + /auth/confirm route handler
components/        # 비즈니스 컴포넌트 (루트) + ui/ (shadcn/ui)
lib/
  supabase/       # 3종 Supabase 클라이언트 + database.types.ts
  utils/          # toast(sonner 래퍼), auth-errors(에러 한글 변환)
middleware.ts     # 모든 요청 인증 가드 → lib/supabase/middleware.ts 위임
docs/             # PRD, ROADMAP, guides/
```

> ⚠️ **주의**: `docs/guides/project-structure.md`는 `src/` 기반으로 작성되어 **현재 실제 구조와 불일치**한다. 실제 구조는 위 플랫 레이아웃이 기준이며, 신규 Route Handler는 PRD 9장 설계(`app/api/{ingest,ocr,validate,match,fx,allocate,export}`)를 따른다.

### Supabase 클라이언트 3종 (환경별 분리)

가장 실수하기 쉬운 부분. 환경에 맞는 클라이언트를 사용할 것:

1. **Server Components / Route Handlers / Server Actions** — `lib/supabase/server.ts`의 `createClient()` (async, 쿠키 기반)
2. **Client Components** — `lib/supabase/client.ts`의 `createClient()` (`createBrowserClient`)
3. **Middleware** — `lib/supabase/middleware.ts`의 `updateSession()`

**중요 제약**:
- Fluid compute 환경 대응: 클라이언트를 전역 변수에 저장하지 말고 **함수 내에서 매번 새로 생성**할 것.
- `middleware.ts`에서 `createServerClient`와 `supabase.auth.getClaims()` **사이에 코드를 추가하지 말 것** (제거 시 SSR에서 사용자가 무작위로 로그아웃됨).
- 미들웨어에서 새 `Response` 객체를 만들 경우 반드시 쿠키를 복사하고 `supabaseResponse`를 그대로 반환할 것.

### 인증 흐름

- `middleware.ts`가 모든 요청을 가로채 인증 확인. 미인증 시 `/auth/login?redirect=<원경로>`로 리디렉션.
- 공개 경로: `/`, `/auth/*`. 그 외 전부 보호 경로.
- 환경 변수 미설정 시 미들웨어는 자동으로 건너뜀(개발 편의).
- 이메일 확인은 `app/auth/confirm/route.ts`에서 처리.
- 로그아웃 등은 Server Action(`app/actions/auth.ts`)으로 처리.

### 폼·검증·피드백 패턴

- **폼**: React Hook Form + Zod(`@hookform/resolvers`) + shadcn `components/ui/form.tsx`. 상세는 `docs/guides/forms-react-hook-form.md`.
- **토스트**: `sonner`를 직접 호출하지 말고 `lib/utils/toast.ts`의 `showSuccess`/`showError`/`showInfo`를 사용. 루트 레이아웃에 `<Toaster>`(`components/ui/sonner.tsx`) 마운트.
- **인증 에러 메시지**: Supabase 영문 에러는 `lib/utils/auth-errors.ts`의 `translateAuthError()`로 한글 변환 후 노출.

### 환경 변수 (`.env.local`)

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

업무 기능 구현 시 추가될 서버 전용 키(Claude API 키, 환율 소스 자격증명 등)는 **`process.env.*` 서버 환경변수에만** 보관하고 클라이언트에 노출 금지(PRD 11장 보안 요구사항).

## 기술 스택

- **프레임워크**: Next.js (App Router, Turbopack), React 19, TypeScript strict
- **인증/DB/Storage**: Supabase (`@supabase/ssr`, `@supabase/supabase-js`), RLS 기반 행 수준 보안
- **스타일링/UI**: TailwindCSS v4(설정 파일 없는 CSS 엔진, `app/globals.css`), shadcn/ui(new-york, `components/ui/`), Lucide React, next-themes(다크 모드)
- **폼/검증**: React Hook Form, Zod
- **데이터 시각화**: Recharts
- **AI (예정)**: Claude API — 신고필증 Vision OCR + 영문↔한글 의미 매칭
- **파일 처리 (예정)**: pdfjs-dist/pdf-lib, xlsx(SheetJS), sharp
- **배포**: Vercel

## 코드 컨벤션

- 파일명 kebab-case, 컴포넌트명 PascalCase, named export 우선(페이지 컴포넌트는 default).
- 상대 경로 대신 `@/*` 별칭 사용.
- `noUnusedLocals`·`noUnusedParameters`가 켜져 있어 미사용 변수는 빌드 실패를 유발.
- 주석·UI 텍스트·에러 메시지는 한국어로 작성.

## Git Hooks

Husky pre-commit 훅이 스테이지된 파일에 대해 lint-staged(ESLint + Prettier)를 자동 실행한다(`.lintstagedrc.json`).

## MCP 서버

- **supabase**: 마이그레이션·SQL 실행·타입 생성 (DB 스키마 변경 전 `list_tables`로 현황 확인)
- **playwright**: 브라우저 자동화·E2E 검증
- **context7**: 라이브러리 문서 조회
- **shadcn**: shadcn/ui 컴포넌트 검색·추가
