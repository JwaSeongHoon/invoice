import { test, expect } from "@playwright/test";

/**
 * 인증 흐름 & 보호 경로 E2E (Phase 1-A / Task 004)
 *
 * 미인증 상태에서 보호 경로 접근 시 /auth/login 리디렉션과
 * 인증 페이지 공개 접근, 폼 클라이언트 검증을 결정론적으로 검증한다.
 * (회원가입→로그인 풀 플로우는 Supabase 이메일 확인 설정에 의존하므로
 *  실측 통합 검증은 Task 019에서 다룬다.)
 */

const PROTECTED_ROUTES = [
  "/protected",
  "/protected/upload",
  "/protected/process/test-batch",
  "/protected/match/test-batch",
  "/protected/allocate/test-batch",
  "/protected/result/test-batch",
];

test.describe("보호 경로 인증 가드", () => {
  for (const route of PROTECTED_ROUTES) {
    test(`미인증 시 ${route} 접근은 로그인으로 리디렉션`, async ({ page }) => {
      await page.goto(route);
      await expect(page).toHaveURL(/\/auth\/login/);
      // 원경로가 redirect 쿼리로 보존되는지 확인
      await expect(page).toHaveURL(new RegExp(`redirect=${encodeURIComponent(route)}`));
    });
  }
});

test.describe("인증 페이지 공개 접근", () => {
  test("로그인 페이지는 미인증 상태로 접근 가능", async ({ page }) => {
    await page.goto("/auth/login");
    await expect(page).toHaveURL(/\/auth\/login/);
    await expect(page.getByRole("button", { name: "로그인" })).toBeVisible();
  });

  test("회원가입 페이지는 미인증 상태로 접근 가능", async ({ page }) => {
    await page.goto("/auth/sign-up");
    await expect(page).toHaveURL(/\/auth\/sign-up/);
    await expect(page.getByRole("button", { name: "회원가입" })).toBeVisible();
  });
});

test.describe("로그인 폼 클라이언트 검증(Zod)", () => {
  test("빈 값 제출 시 검증 메시지 노출", async ({ page }) => {
    await page.goto("/auth/login");
    await page.getByRole("button", { name: "로그인" }).click();
    await expect(page.getByText("이메일을 입력해주세요")).toBeVisible();
    await expect(page.getByText("비밀번호를 입력해주세요")).toBeVisible();
    // 검증 실패 시 페이지 이동 없음
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test("잘못된 이메일 형식 검증", async ({ page }) => {
    await page.goto("/auth/login");
    await page.getByLabel("이메일").fill("not-an-email");
    await page.getByLabel("비밀번호").fill("password123");
    await page.getByRole("button", { name: "로그인" }).click();
    await expect(page.getByText("올바른 이메일 형식이 아닙니다")).toBeVisible();
  });
});

test.describe("회원가입 폼 클라이언트 검증(Zod)", () => {
  test("비밀번호 불일치 검증", async ({ page }) => {
    await page.goto("/auth/sign-up");
    await page.getByLabel("이메일").fill("user@example.com");
    await page.getByLabel("비밀번호", { exact: true }).fill("password123");
    await page.getByLabel("비밀번호 확인").fill("different123");
    await page.getByRole("button", { name: "회원가입" }).click();
    await expect(page.getByText("비밀번호가 일치하지 않습니다")).toBeVisible();
  });
});
