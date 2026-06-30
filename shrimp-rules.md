# 개발 가이드라인 (shrimp-rules.md)

> **이 문서는 Coding Agent(AI) 전용 운영 규칙이다.** 일반 개발 지식은 포함하지 않는다. 본 프로젝트에서만 통용되는 규칙·금지사항·파일 연동 요구사항만 기술한다.
> **선행 필독**: `CLAUDE.md`, `docs/PRD.md`, `docs/ROADMAP.md`. 본 문서와 충돌 시 우선순위는 `CLAUDE.md` > `shrimp-rules.md` > 기타 문서.

---

## 1. 프로젝트 개요

- **수입정산 매니저**: 영문 수입신고필증(PDF 스캔) + 한글 입고현황(xlsx)을 Claude AI로 매칭하고 부대비용을 품목별 안분하여 **이카운트 ERP 24컬럼 xlsx**를 자동 생성하는 Next.js 15 + Supabase 풀스택 웹앱.
- **현재 상태**: Supabase 인증이 구현된 스타터. 업무 기능(업로드·OCR·매칭·안분·환율·양식 생성)은 **전부 미구현**. 신규 기능 추가가 작업의 대부분이다.
- **기능 ID 체계**: 모든 업무 기능은 `F001`~`F022`로 식별된다. 기능 구현 시 반드시 `docs/PRD.md` 7장의 해당 `Fxxx` 상세 요구사항을 먼저 읽을 것.

---

## 2. 디렉터리·경로 규칙

### 2.1 플랫 구조 (필수 준수)

- 프로젝트는 **`src/` 디렉터리를 사용하지 않는다.** `app/`·`components/`·`lib/`는 **프로젝트 루트 직속**이다.
- 경로 별칭 `@/*`는 **프로젝트 루트(`./*`)**로 매핑된다.
- **금지**: 상대 경로 import (`../../lib/...`). **필수**: `@/*` 별칭 사용.
  - ❌ `import { createClient } from "../../lib/supabase/server"`
  - ✅ `import { createClient } from "@/lib/supabase/server"`
- **금지**: `src/` 디렉터리 생성, 그 안에 `app/`·`components/`·`lib/` 배치.

### 2.2 신규 파일 배치 규칙

| 추가하려는 것 | 배치 위치 |
|---|---|
| 페이지 | `app/<route>/page.tsx` (보호 경로는 `app/protected/` 하위) |
| Route Handler | `app/api/<name>/route.ts` (아래 4장 경로표 준수) |
| Server Action | `app/actions/<domain>.ts` (`"use server"` 선언) |
| 비즈니스 컴포넌트 | `components/<name>.tsx` (kebab-case) |
| shadcn/ui 컴포넌트 | `components/ui/` (직접 작성 금지, `npx shadcn@latest add` 사용) |
| Supabase 클라이언트 호출 | 기존 `lib/supabase/{server,client,middleware}.ts` 재사용 |
| 도메인 유틸 | `lib/utils/<name>.ts` |
| 환율/파일처리 등 도메인 로직 | `lib/<domain>/` 신규 폴더 (예: `lib/fx/`, `lib/pdf/`, `lib/xlsx/`) |

- ⚠️ **주의**: `docs/guides/project-structure.md`는 `src/` 기반으로 작성되어 **실제 구조와 불일치한다.** 구조 판단의 기준은 본 문서 2.1이며, `project-structure.md`의 경로를 그대로 따르지 말 것.

---

## 3. Supabase 클라이언트 3종 — 환경별 강제 분리

**가장 실수하기 쉬운 부분. 환경을 틀리면 인증이 깨진다.**

| 실행 환경 | 사용할 함수 | import 경로 | 호출 방식 |
|---|---|---|---|
| Server Component / Route Handler / Server Action | `createClient()` | `@/lib/supabase/server` | **`await` 필수** (async) |
| Client Component (`"use client"`) | `createClient()` | `@/lib/supabase/client` | 동기 호출 |
| Middleware | `updateSession()` | `@/lib/supabase/middleware` | 미들웨어 외 호출 금지 |

- ✅ Route Handler 내부: `const supabase = await createClient();` (server 버전)
- ❌ Route Handler에서 client 버전(`@/lib/supabase/client`) import 금지.
- ❌ Client Component에서 server 버전 import 금지 (`next/headers` 의존으로 빌드 실패).

### 3.1 절대 금지 사항 (인증 파손 방지)

- **금지**: Supabase 클라이언트를 모듈 전역 변수에 저장. **반드시 함수 내부에서 매 호출마다 새로 생성**할 것 (Fluid compute 대응).
- **금지**: `lib/supabase/middleware.ts`에서 `createServerClient(...)` 생성과 `await supabase.auth.getClaims()` **사이에 코드 삽입.** 이 사이에 코드를 넣거나 `getClaims()`를 제거하면 SSR에서 사용자가 무작위로 로그아웃된다.
- **금지**: 미들웨어에서 새 `Response`를 만들고 `supabaseResponse` 대신 반환. 새 Response가 필요하면 반드시 쿠키를 복사하고 최종적으로 `supabaseResponse`를 반환.
- ❌ `auth.getUser()` 결과를 신뢰해 미들웨어 흐름을 재작성하지 말 것. 현재 흐름은 `getClaims()` 기반이다.

---

## 4. Route Handler 구현 규칙 (업무 파이프라인)

신규 Route Handler는 **반드시 아래 경로·역할 표를 따른다.** 임의 경로 생성 금지.

| 경로 | 역할 | 관련 기능 |
|---|---|---|
| `POST app/api/ingest/route.ts` | 파일 수신·분류, 정산서 파싱, xlsx 파싱, Storage 저장 | F001~F003, F006 |
| `POST app/api/ocr/route.ts` | 신고필증 이미지 렌더링 → Claude Vision → 구조화 JSON | F004 |
| `POST app/api/validate/route.ts` | ㉟=㊶ 수량 검증, `validation_log` 기록 | F005 |
| `POST app/api/match/route.ts` | 코드 매칭(1순위) → AI 의미매칭(2순위) → 후보 반환 | F007, F008 |
| `PATCH app/api/match/[id]/route.ts` | 매칭 수동 확정 (`confirmed_by` 기록) | F009 |
| `POST app/api/fx/route.ts` | 환율 조회 (캐시→하나은행→서울외환→수동) | F012 |
| `POST app/api/allocate/route.ts` | 외화단가 역산·부대비용 안분·원화 환산·검증 | F011, F013, F014 |
| `GET app/api/export/[batchId]/route.ts` | 이카운트 24컬럼 xlsx 생성 + 검증 리포트 | F015, F016 |

### 4.1 Route Handler 필수 규칙

- 모든 Route Handler 진입부에서 `const supabase = await createClient();`로 클라이언트를 새로 생성하고, 인증·RLS는 Supabase에 위임한다.
- ❌ Claude API 키·환율 소스 자격증명을 클라이언트로 반환하거나 `NEXT_PUBLIC_*`로 노출 금지. **서버 전용 `process.env.*`에서만 읽을 것.**
- DB 쓰기 작업은 PRD 8장 데이터 모델의 테이블·컬럼명을 정확히 사용한다 (아래 5장 참조).

---

## 5. 데이터 모델·DB 작업 규칙

### 5.1 테이블·컬럼명 고정

- 업무 테이블 8종: `import_batch`, `settlement`, `declaration_item`, `inventory_item`, `item_match`, `allocation_result`, `fx_rate_cache`, `validation_log`.
- 컬럼명·타입·관계는 **`docs/PRD.md` 8장이 단일 진실 공급원(SSOT)**이다. 임의로 컬럼명을 바꾸거나 추가하지 말고, 필요 시 PRD 8장을 먼저 수정 제안할 것.
- **상태값(enum 문자열) 고정**:
  - `import_batch.status`: `uploading` / `processing` / `matching` / `done` / `error`
  - `item_match.method`: `code` / `ai` / `manual`
  - `item_match.status`: `match` / `mismatch` / `review`
  - `fx_rate_cache.source`: `hana` / `smbs` / `manual`
  - `validation_log.type`: `qty3541` / `unitprice` / `alloc_freight` / `alloc_fee` / `alloc_etc`
  - `currency_code`: USD=`00001`, CNY=`00002` (이카운트 통화코드)
- ❌ 위 문자열 리터럴을 다른 영단어로 바꾸지 말 것 (예: `done`을 `completed`로 변경 금지).

### 5.2 DB 스키마 변경 절차 (필수 순서)

1. **변경 전** Supabase MCP `list_tables`로 현재 스키마 확인.
2. `mcp__supabase__apply_migration`으로 마이그레이션 적용 (RLS 정책 포함).
3. **변경 후** 반드시 타입 재생성: `npm run db:types` 또는 `mcp__supabase__generate_typescript_types` → `lib/supabase/database.types.ts` 갱신.
4. 마이그레이션 적용 후 `mcp__supabase__get_advisors`로 보안·성능 경고 확인.

- **다중 파일 연동 (필수)**: 테이블/컬럼을 변경하면 → `lib/supabase/database.types.ts` 재생성 → 해당 타입을 쓰는 Route Handler·컴포넌트 동기 수정.
- 모든 업무 테이블에 **RLS 정책 필수**: `user_id = auth.uid()` 또는 `batch_id`를 통해 `import_batch.user_id = auth.uid()`로 제한. `fx_rate_cache`만 공용 읽기 허용.

---

## 6. 핵심 계산·검증 로직 규칙 (틀리면 회계 데이터 오염)

이 규칙은 PRD 7장 수식을 그대로 코드화해야 한다. 임의 변형 금지.

### 6.1 검증 3종 — 통과해야만 다운로드 허용

- **㉟=㊶ 검증 (F005)**: `Σ(모든 페이지 qty_35) == Σ(모든 페이지 qty_41_total)`. 불일치 시 진행 차단, 메시지 정확히 **"수입신고필증의 35번 수량 합계와 41번 수량 합계가 일치하지 않습니다."** 사용, `validation_log(type=qty3541, passed=false)` 기록.
- **외화단가 역산 (F011)**: `Σ(행 수량 × 보정 단가) == 신고필증 품목 총액`.
- **안분 합계 (F013)**: 운반비·수수료·기타 각 칸의 `Σ(품목 안분액) == 정산서 해당 칸 총액`.

### 6.2 안분·환산 수식 (PRD 7장 F013/F014 준수)

- 안분 기준: 수량 일치 → **신고수량 기준**, 수량 불일치 → **입고수량 기준**.
- 이카운트 칸 매핑 (변경 금지): `운반비 = 통관수수료 + 업무운임 SUB TOTAL`, `수수료 = 통관부가세`, `기타 = 관세`.
- 원화 환산: `단가(원화)=외화단가×환율`, `공급가액=수량×단가/1.1`, `부가세=공급가액×10%`.
- **반올림**: 원 단위 반올림 후 잔차는 **최대 수량 품목에 가산** (합계 일치 보장).
- ❌ 부동소수 비교를 `==`로 직접 하지 말 것. 금액 비교는 원 단위 반올림 후 비교.

### 6.3 AI 매칭 임계값 (고정)

- 코드 매칭(F007): `정규화(품목코드 앞 10자리) == 정규화(모델번호)`. 정규화 = 공백 제거 + 대문자 통일 + 특수문자 제거.
- AI 의미매칭(F008) 자동 확정: 최고 점수 **`>= 0.90`** 이고 2위와 격차 충분. 미달 시 `status=review`로 수동 확정.
- OCR 신뢰도(F004): `confidence < 0.85` → "OCR 저신뢰" 플래그, 처리는 중단하지 않음.
- ❌ 임계값 `0.90`, `0.85`, 코드 매칭 `10자리`를 임의 변경 금지 (변경 필요 시 PRD 수정 제안 후 진행).

### 6.4 환율 어댑터 패턴 (필수)

- 환율 소스는 **어댑터로 분리**한다 (`lib/fx/` 하위에 `hana`·`smbs` 어댑터). 조회 순서 고정: `fx_rate_cache` → 하나은행(`hana`) → 서울외국환중개소(`smbs`) → 수동 오버라이드(`manual`).
- 비영업일(주말) 입고 시 직전 영업일 고시 적용. 공휴일은 MVP에서 수동 오버라이드 허용.

---

## 7. 클라이언트 UI·폼·피드백 규칙

### 7.1 토스트 (직접 호출 금지)

- ❌ `import { toast } from "sonner"` 직접 호출 금지.
- ✅ `@/lib/utils/toast`의 `showSuccess` / `showError` / `showInfo` 사용.
- 루트 레이아웃(`app/layout.tsx`)에 `<Toaster>`(`@/components/ui/sonner`) 마운트 유지.

### 7.2 인증 에러 메시지 (한글 변환 강제)

- Supabase 영문 에러는 그대로 노출 금지. `@/lib/utils/auth-errors`로 변환:
  - 에러 객체(`unknown`/`Error`) → `getAuthErrorMessage(error)` 사용 (컴포넌트 catch 블록).
  - 순수 문자열 메시지 → `translateAuthError(message)` 사용.
- ✅ 예: `catch (error: unknown) { const message = getAuthErrorMessage(error); showError(message); }`

### 7.3 폼

- 폼은 React Hook Form + Zod(`@hookform/resolvers`) + `@/components/ui/form` 조합 사용. 상세 패턴은 `docs/guides/forms-react-hook-form.md` 참조.
- ❌ 새 검증 라이브러리(yup 등) 추가 금지. 검증은 Zod로 통일.

---

## 8. 코드 스타일·네이밍 규칙

- 파일명 **kebab-case** (`login-form.tsx`), 컴포넌트명 **PascalCase** (`LoginForm`).
- export: **named export 우선**. 단, `app/**/page.tsx`·`layout.tsx`의 페이지 컴포넌트는 **default export**.
- ❌ 미사용 변수·파라미터 금지: `noUnusedLocals`·`noUnusedParameters`가 켜져 있어 미사용 시 **빌드 실패**. 임시로 둘 변수는 만들지 말 것.
- 주석·UI 텍스트·에러 메시지·커밋 메시지는 **모두 한국어**.
- TypeScript `strict` 모드. `any` 남용 금지, 에러는 `unknown`으로 받고 좁히기.

---

## 9. 환경 변수 규칙

- 클라이언트 노출 가능 (`.env.local`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- ❌ **신규 서버 시크릿(Claude API 키, 환율 소스 자격증명 등)에 `NEXT_PUBLIC_` 접두사 금지.** 서버 전용 `process.env.*`로만 보관·접근.
- 환경 변수 추가 시 `.env.example`에 키 이름과 설명을 동기 추가 (값은 비움).

---

## 10. 작업 완료 체크리스트 (필수)

작업 종료 전 **반드시** 아래를 통과시킬 것:

1. `npm run check-all` (typecheck + lint + format:check) 통과.
2. `npm run build` 통과.
3. API·비즈니스 로직 구현 시 `docs/ROADMAP.md`의 해당 Task 완료 기준 충족 + Playwright 테스트 체크리스트 수행 (E2E는 `e2e/` 디렉터리).

- ❌ 위 검사 미통과 상태로 작업 완료 보고 금지.
- 커밋 시 Husky pre-commit 훅이 lint-staged(ESLint+Prettier)를 자동 실행하므로, 포맷 깨진 코드는 커밋되지 않음을 전제로 작성.

---

## 11. 다중 파일 동기 수정 요구사항 (요약)

| 변경 대상 | 함께 수정해야 할 파일 |
|---|---|
| DB 테이블/컬럼 (마이그레이션) | `lib/supabase/database.types.ts` 재생성 + 해당 타입 사용처 전부 |
| 신규 환경 변수 추가 | `.env.example` (키·설명 추가) + 사용 코드 |
| 새 업무 기능(Fxxx) 구현 | 해당 Route Handler + 연관 페이지 UI + `docs/ROADMAP.md` Task 상태 업데이트 |
| 데이터 모델 변경 | `docs/PRD.md` 8장 (SSOT) 먼저 갱신 후 코드 반영 |
| 새 shadcn 컴포넌트 필요 | `npx shadcn@latest add <name>` (수동 작성 금지) |

---

## 12. AI 의사결정 트리

- **"이 로직 어느 환경 클라이언트?"** → Route Handler/Server Component/Server Action이면 `@/lib/supabase/server` (await), `"use client"` 파일이면 `@/lib/supabase/client`.
- **"새 API를 만들어야 하나?"** → 4장 경로표에 해당 역할이 있으면 그 경로 사용. 없으면 새 경로 만들기 전 PRD 9장과 대조하고, 정말 신규면 같은 네이밍 컨벤션으로 `app/api/<name>/route.ts` 생성.
- **"계산/임계값을 바꿔야 할 것 같다"** → 임의 변경 금지. PRD 7장 수식·임계값이 우선. 변경이 필요하면 PRD 수정을 먼저 제안.
- **"문서가 서로 다르게 말한다"** → 우선순위: `CLAUDE.md` > `shrimp-rules.md` > `docs/PRD.md` > `docs/guides/*`. 특히 `docs/guides/project-structure.md`의 `src/` 구조는 무시(2.2 참조).
- **"모호한 지시(예: '규칙 업데이트')"** → 사용자에게 즉시 되묻지 말 것. 먼저 코드베이스·최근 변경·기존 문서를 자체 분석해 추정 변경점을 도출하고, 그 근거와 함께 구체적 수정안을 제시.

---

## 13. 절대 금지 사항 (Prohibited)

- ❌ `src/` 디렉터리 도입.
- ❌ 상대 경로 import (`@/*` 별칭 강제).
- ❌ Supabase 클라이언트 전역 변수 저장.
- ❌ 미들웨어 `createServerClient`↔`getClaims()` 사이 코드 삽입 / `getClaims()` 제거 / `supabaseResponse` 미반환.
- ❌ 서버 시크릿에 `NEXT_PUBLIC_` 접두사 부여, 클라이언트로 시크릿 반환.
- ❌ `sonner`의 `toast` 직접 호출 (반드시 `lib/utils/toast` 래퍼).
- ❌ Supabase 영문 에러 원문 노출 (반드시 한글 변환).
- ❌ PRD 8장 테이블/컬럼명·상태 문자열, PRD 7장 수식·임계값 임의 변경.
- ❌ `shadcn/ui` 컴포넌트 수동 작성 (CLI 사용).
- ❌ 미사용 변수/파라미터 방치 (빌드 실패).
- ❌ `npm run check-all` / `npm run build` 미통과 상태로 완료 보고.
- ❌ UI 텍스트·주석·커밋 메시지를 한국어 외 언어로 작성.
