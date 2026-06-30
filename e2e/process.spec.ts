import { test, expect } from "@playwright/test";

/**
 * 처리 진행 페이지 E2E (Phase 1-B / Task 009)
 *
 * 인증 후 기존 배치의 처리 진행 페이지로 진입하여 OCR→수량 검증 오케스트레이션이
 * 완료되고 매칭 검토 페이지로 자동 전환되는지 검증한다. (실제 Claude Vision 호출 포함)
 *
 * 참고: 본 스펙은 실 Claude 호출(~15초)을 포함하므로 ANTHROPIC_API_KEY가 설정된
 * 환경에서만 통과한다. 개별 엔드포인트(/api/ocr·/api/validate)는 통합 테스트로 검증됨.
 */

const TEST_EMAIL = "qa-ingest@invoice.test";
const TEST_PASSWORD = "password123";
const BATCH_ID = "92f4fd5f-ea17-46f6-84d0-c11474e8b384";

test("처리 진행 → OCR·검증 → 매칭 검토 자동 전환", async ({ page }) => {
  test.setTimeout(120_000);

  await page.goto("/auth/login");
  await page.getByLabel("이메일").fill(TEST_EMAIL);
  await page.getByLabel("비밀번호").fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "로그인" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/auth/login"));

  await page.goto(`/protected/process/${BATCH_ID}`);

  await expect(page.getByText("신고필증 OCR")).toBeVisible();
  await expect(page.getByText("수량 검증 (㉟=㊶)")).toBeVisible();

  await page.waitForURL(new RegExp(`/protected/match/${BATCH_ID}`), { timeout: 90_000 });
  await expect(page.getByRole("heading", { name: "매칭 검토" })).toBeVisible();
});
