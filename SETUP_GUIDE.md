# 🚀 시작 가이드 (Next.js + Supabase 인증 스타터킷)

Next.js 15 (App Router) + Supabase Auth 기반의 인증 스타터킷입니다.
이메일/비밀번호 회원가입·로그인, 비밀번호 재설정, 보호된 라우트, 다크 모드가 기본 포함되어 있습니다.

압축을 푼 뒤 아래 순서대로 따라 하면 됩니다.

---

## 0. 사전 준비물

| 항목 | 권장 버전 | 확인 명령 |
| --- | --- | --- |
| Node.js | 20 이상 (LTS) | `node -v` |
| npm | 10 이상 | `npm -v` |
| Supabase 계정 | - | https://supabase.com (무료) |

> Node.js가 없다면 https://nodejs.org 에서 LTS 버전을 설치하세요.

---

## 1. 압축 해제 & 폴더 이동

```bash
# zip 압축을 원하는 위치에 해제한 뒤
cd nextjs-supabase-starter
```

---

## 2. 의존성 설치

```bash
npm install
```

> 설치 중 Husky(Git 훅) 관련 메시지가 보일 수 있습니다. Git 저장소가 아니면 무시해도 되고,
> 3-1단계처럼 `git init`을 먼저 하면 훅이 정상 설정됩니다.

---

## 3. Supabase 프로젝트 만들기

1. https://database.new 접속 → 새 프로젝트 생성 (조직/이름/DB 비밀번호 입력)
2. 프로젝트가 준비되면 좌측 메뉴 **Project Settings → API** 로 이동
3. 다음 두 값을 복사해 둡니다.
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **Project API Keys**의 `anon` / `publishable` 키 → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

---

## 4. 환경 변수 설정

`.env.example` 파일을 복사해 `.env.local` 을 만들고, 3번에서 복사한 값을 채웁니다.

```bash
# macOS / Linux
cp .env.example .env.local

# Windows (PowerShell)
Copy-Item .env.example .env.local
```

`.env.local` 내용 예시:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxxxxxxxxxxxxxx
```

> `.env.local` 은 `.gitignore` 에 의해 커밋되지 않습니다. 키를 깃에 올리지 마세요.

---

## 5. 개발 서버 실행

```bash
npm run dev
```

브라우저에서 http://localhost:3000 접속.

- 메인 화면에서 환경 변수가 정상이면 우측 상단에 **Sign in / Sign up** 버튼이 보입니다.
- 환경 변수가 비어 있으면 안내 배너가 표시됩니다. (4번 단계를 다시 확인하세요.)

---

## 6. 인증 동작 확인

1. **Sign up** → 이메일/비밀번호로 회원가입
2. Supabase는 기본적으로 **이메일 인증**이 켜져 있습니다.
   - 받은 메일의 확인 링크를 클릭하면 인증 완료
   - (개발 편의를 위해 끄려면) Supabase 대시보드 → **Authentication → Sign In / Providers → Email** 에서 *Confirm email* 옵션 조정
3. 로그인 후 `/protected` 페이지 접속 → 로그인한 사용자만 볼 수 있는 페이지가 표시됩니다.

---

## 7. (선택) Git 저장소로 초기화

```bash
git init
git add .
git commit -m "chore: init from starter kit"
```

> Husky pre-commit 훅이 활성화되어 커밋 시 ESLint + Prettier 가 자동 실행됩니다.

---

## 8. 코드 품질 / 빌드 확인

```bash
npm run check-all   # 타입체크 + ESLint + Prettier 검사 한 번에
npm run build       # 프로덕션 빌드 성공 확인
```

---

## 9. (선택) Vercel 배포

1. 코드를 GitHub 저장소에 푸시
2. https://vercel.com 에서 New Project → 해당 저장소 선택
3. **Environment Variables** 에 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` 추가
4. Deploy

> 배포 후 Supabase 대시보드 → **Authentication → URL Configuration** 의
> Site URL / Redirect URLs 에 배포 도메인을 추가해야 이메일 인증·비밀번호 재설정 링크가 정상 동작합니다.

---

## 📁 주요 구조

```
app/
  page.tsx              # 랜딩 페이지
  layout.tsx            # 루트 레이아웃 (테마/토스트)
  auth/                 # 로그인·회원가입·비밀번호 재설정·이메일 확인
  protected/            # 인증된 사용자 전용 라우트
  actions/auth.ts       # 로그아웃 Server Action
components/
  ui/                   # shadcn/ui 컴포넌트
  *-form.tsx            # 인증 폼들
lib/
  supabase/             # 3종 Supabase 클라이언트 (server/client/middleware)
  utils/                # 토스트·에러 메시지 유틸
middleware.ts           # 인증 미들웨어 (보호 라우트 처리)
.env.example            # 환경 변수 템플릿
CLAUDE.md               # 프로젝트 규칙 (Claude Code 사용 시 참고)
docs/guides/            # Next.js 15 / 폼 / 스타일 가이드
```

---

## 🛠️ 자주 쓰는 명령어

```bash
npm run dev          # 개발 서버 (Turbopack)
npm run build        # 프로덕션 빌드
npm run start        # 프로덕션 서버
npm run check-all    # 타입체크 + lint + format 검사
npm run lint:fix     # ESLint 자동 수정
npm run format       # Prettier 포맷팅
npx shadcn@latest add [component]   # shadcn/ui 컴포넌트 추가
```

---

## 🗄️ 데이터베이스 타입 (테이블 추가 시)

기본 `lib/supabase/database.types.ts` 는 빈 스텁입니다.
Supabase에 테이블을 만든 뒤 타입을 자동 생성하려면 Supabase CLI 설치 후:

```bash
# 원격 프로젝트 기준 (SUPABASE_PROJECT_ID 환경 변수 필요)
npm run db:types

# 로컬 Supabase 기준
npm run db:types:local
```

---

## ❓ 문제 해결

- **로그인 후 계속 /auth/login 으로 튕김** → `.env.local` 값과 미들웨어 설정 확인
- **이메일 인증 메일이 안 옴** → Supabase Authentication 설정 / 스팸함 확인, 또는 Confirm email 임시 비활성화
- **`@/...` import 오류** → `tsconfig.json` 이 루트에 있는지 확인 후 `npm install` 재실행

즐거운 개발 되세요! 🎉
