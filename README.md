# 수입정산 매니저

> 영문 수입신고필증(PDF 스캔)과 한글 입고현황(xlsx)을 Claude AI로 자동 매칭하고, 부대비용을 품목별로 안분하여 **이카운트 ERP 업로드 양식(24컬럼 xlsx)**을 자동 완성하는 풀스택 웹 애플리케이션.

중소 무역·유통사 회계 담당자의 수작업 대조·계산·기입을 제거하는 것이 목표입니다.

---

## 핵심 가치

기존에는 회계 담당자가 영문 신고필증과 한글 입고현황을 **눈으로 대조**하고, 부대비용을 **수기로 안분**하며, 입고일 환율을 **직접 조회**해 이카운트 양식에 **수기로 기입**해야 했습니다. 이 시스템은 그 전 과정을 자동화합니다.

```
파일 업로드 (PDF + xlsx)
  → AI 자동 처리 (PDF 분류 · Vision OCR · 정산서 파싱 · 수량 검증)
  → 매칭 검토 (코드 자동 매칭 + AI 의미 매칭 + 애매건 1클릭 확정)
  → 안분 · 환율 자동 계산
  → 이카운트 24컬럼 양식 + 검증 리포트 다운로드
```

---

## 주요 기능

| 단계 | 기능 | 설명 |
|------|------|------|
| **업로드** | 파일 업로드·검증 | PDF(정산서+신고필증) + xlsx(입고현황) 드래그&드롭, 형식·필수 컬럼 검증 |
| **처리** | PDF 페이지 분류 | 수입정산서 / 세금계산서 / 신고필증 / 보험증권 동적 판정 (ACE 경계 신호) |
| **처리** | 수입정산서 파싱 | B/L번호·관세율·부대비용·SUB TOTAL·환율 구조화 추출 |
| **처리** | 신고필증 Vision OCR | Claude Vision으로 모델·㉟수량·㊱단가·㊲금액·㊶수량·환율을 JSON 추출 |
| **처리** | 수량 검증 (㉟=㊶) | 신고필증 전 페이지 수량 합계 비교, 불일치 시 진행 차단 |
| **매칭** | 코드 매칭 (1순위) | 입고 품목코드 앞 10자리 ↔ 신고필증 모델번호 정규화 비교 |
| **매칭** | AI 의미 매칭 (2순위) | 영문↔한글 품목명 의미 유사도 점수, 0.90 이상 자동 확정 |
| **매칭** | 수동 확정 UX | "확인요" 항목을 후보 점수순으로 제시, 1클릭 확정 |
| **결과** | 외화단가 역산 보정 | 행별 수량 비중으로 단가 배분, 신고필증 총액과 일치 검증 |
| **결과** | 환율 자동 연동 | 입고일 기준 하나은행 → 서울외환 폴백 → 수동 입력, 캐시 지원 |
| **결과** | 부대비용 안분 | 운반비·수수료·기타 칸에 수량 비중 안분, 합계 검증 |
| **결과** | 원화 환산 | 단가·공급가액·부가세 자동 계산, 통화코드 자동 |
| **출력** | 이카운트 양식 생성 | 24컬럼 순서 유지 xlsx 자동 완성 |
| **출력** | 검증 리포트 | 3종 검증(㉟=㊶·단가 역산·안분 합계) + 매칭 요약 + OCR 저신뢰 플래그 |

---

## 기술 스택

- **프레임워크**: Next.js 15 (App Router, Turbopack), React 19, TypeScript (strict)
- **인증 / DB / Storage**: Supabase (`@supabase/ssr`), RLS 기반 행 수준 보안
- **스타일링 / UI**: TailwindCSS v4, shadcn/ui (new-york), Lucide React, next-themes
- **폼 / 검증**: React Hook Form, Zod
- **AI**: Claude API (`@anthropic-ai/sdk`) — 신고필증 Vision OCR + 영문↔한글 의미 매칭
- **파일 처리**: pdfjs-dist / pdf-lib (PDF), xlsx/SheetJS (엑셀)
- **데이터 시각화**: Recharts
- **테스트**: Playwright (E2E)
- **배포**: Vercel

---

## 시작하기

### 1. 사전 준비

- Node.js 20 이상
- [Supabase 프로젝트](https://database.new) (Auth · PostgreSQL · Storage)
- Claude API 키 ([Anthropic Console](https://console.anthropic.com))

### 2. 의존성 설치

```bash
npm install
```

### 3. 환경 변수 설정

프로젝트 루트에 `.env.local` 파일을 만들고 다음을 채웁니다.

```bash
# Supabase (클라이언트 노출 가능)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=

# 서버 전용 (클라이언트 노출 금지)
ANTHROPIC_API_KEY=
```

> Supabase 값은 [프로젝트 API 설정](https://supabase.com/dashboard/project/_?showConnect=true)에서 확인할 수 있습니다.
> Claude API 키 · 환율 소스 자격증명 등 서버 전용 키는 반드시 `process.env.*` 서버 환경변수로만 보관하고 클라이언트에 노출하지 않습니다.

### 4. 개발 서버 실행

```bash
npm run dev
```

[localhost:3000](http://localhost:3000/)에서 확인합니다.

---

## 개발 명령어

```bash
# 개발 / 빌드
npm run dev            # 개발 서버 (Turbopack)
npm run build          # 프로덕션 빌드
npm run check-all      # typecheck + lint + format:check (작업 완료 전 필수)

# 개별 검사
npm run typecheck      # tsc --noEmit (strict + noUnusedLocals/Parameters)
npm run lint:fix       # ESLint 자동 수정
npm run format         # Prettier 포맷팅

# E2E 테스트 (Playwright, testDir: ./e2e)
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

> **작업 완료 체크리스트**: `npm run check-all` + `npm run build` 통과 확인.

---

## 프로젝트 구조

경로 별칭 `@/*`는 **프로젝트 루트**로 매핑됩니다 (`src/` 없는 플랫 구조).

```
app/                  # Next.js App Router (페이지 + Route Handler + Server Action)
  actions/            # Server Actions ("use server") — auth, batch
  api/                # Route Handlers
    ingest/           #   파일 수신 · PDF 분류 · 정산서/xlsx 파싱
    ocr/              #   신고필증 Vision OCR
    validate/         #   ㉟=㊶ 수량 검증
    match/            #   코드 매칭 + AI 의미 매칭 (+ [id] 수동 확정)
    fx/               #   환율 조회 (캐시 → 하나은행 → 서울외환 → 수동)
    allocate/         #   외화단가 역산 · 부대비용 안분 · 원화 환산
    export/[batchId]/ #   이카운트 24컬럼 xlsx + 검증 리포트 생성
  auth/               # 인증 페이지 + /auth/confirm route handler
  protected/          # 보호 경로 (배치 목록 · 업로드 · 처리 · 매칭 · 안분 · 결과)
components/           # 비즈니스 컴포넌트 (루트) + ui/ (shadcn/ui)
lib/
  supabase/           # 3종 Supabase 클라이언트 + database.types.ts
  utils/              # toast(sonner 래퍼), auth-errors(에러 한글 변환)
middleware.ts         # 모든 요청 인증 가드 → lib/supabase/middleware.ts 위임
docs/                 # PRD, ROADMAP, guides/
e2e/                  # Playwright E2E 스펙
```

### Supabase 클라이언트 3종 (환경별 분리)

환경에 맞는 클라이언트를 사용해야 합니다.

1. **Server Components / Route Handlers / Server Actions** — `lib/supabase/server.ts`의 `createClient()` (async, 쿠키 기반)
2. **Client Components** — `lib/supabase/client.ts`의 `createClient()` (`createBrowserClient`)
3. **Middleware** — `lib/supabase/middleware.ts`의 `updateSession()`

> Fluid compute 환경 대응을 위해 클라이언트를 전역 변수에 저장하지 말고 **함수 내에서 매번 새로 생성**합니다.

### 인증 흐름

- `middleware.ts`가 모든 요청을 가로채 인증을 확인하고, 미인증 시 `/auth/login?redirect=<원경로>`로 리디렉션합니다.
- 공개 경로: `/`, `/auth/*`. 그 외 전부 보호 경로.
- 환경 변수 미설정 시 미들웨어는 자동으로 건너뜁니다 (개발 편의).

---

## 데이터 모델

Supabase PostgreSQL 8개 테이블 (모두 RLS 적용):

| 테이블 | 역할 |
|--------|------|
| `import_batch` | 정산 처리 배치 (상태·원본 파일 경로) |
| `settlement` | 수입정산서 파싱 결과 (B/L·부대비용·관세) |
| `declaration_item` | 신고필증 OCR 라인 아이템 (모델·수량·단가·신뢰도) |
| `inventory_item` | 입고현황 xlsx 행 (품목코드·수량·외화단가·입고일) |
| `item_match` | 매칭 결과 (방법·점수·상태) |
| `allocation_result` | 안분·환산 결과 (= 이카운트 행) |
| `fx_rate_cache` | 환율 캐시 (일자·통화·출처) |
| `validation_log` | 검증 결과 로그 (3종 검증 통과/실패) |

상세 스키마와 관계는 [`docs/PRD.md` 8장](docs/PRD.md)을 참고하세요.

---

## 문서

- **[`docs/PRD.md`](docs/PRD.md)** — MVP 기능 명세(F001~F022), 데이터 모델, Route Handler 설계, 수용 기준(AC-01~06)
- **[`docs/ROADMAP.md`](docs/ROADMAP.md)** — Phase 1-A~1-E, Task 001~022 개발 순서·의존성·완료 기준
- **[`docs/기획_수입부대비용안분_자동화_설계서.md`](docs/기획_수입부대비용안분_자동화_설계서.md)** — 근거 설계서
- **[`docs/검증로직.md`](docs/검증로직.md)** — PDF 분류·수량 검증 등 검증 규칙 상세
- **[`docs/guides/`](docs/guides/)** — Next.js 15·폼·스타일링·컴포넌트 패턴 가이드
- **[`CLAUDE.md`](CLAUDE.md)** — Claude Code 작업 시 준수 사항

---

## 보안

- 모든 업무 테이블에 `user_id = auth.uid()` 기반 RLS 정책 적용 — 본인 배치 데이터만 접근 가능
- 원본 PDF·xlsx는 Supabase Storage **비공개 버킷**에 저장, 서명 URL(만료 제한)로만 접근
- Claude API 키·환율 소스 자격증명은 **서버 환경변수에만** 보관, 클라이언트 노출 금지

---

## 배포

[Vercel](https://vercel.com)에 최적화되어 있습니다. Supabase 환경 변수와 `ANTHROPIC_API_KEY`를 Vercel 프로젝트 환경 변수에 등록한 뒤 배포합니다.
