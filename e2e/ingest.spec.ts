import { test, expect } from "@playwright/test";
import path from "path";

/**
 * /api/ingest 파이프라인 E2E (Phase 1-B / Task 005)
 *
 * 확인된 테스트 사용자로 로그인 후 실측 PDF+xlsx를 업로드하여
 * PDF 분류·정산서 파싱 결과(네트워크 응답)와 처리 진행 페이지 전환을 검증한다.
 */

const TEST_EMAIL = "qa-ingest@invoice.test";
const TEST_PASSWORD = "password123";
const PDF_PATH = path.resolve(__dirname, "../docs/최종정산서_XMCCLINC26050074.pdf");
const XLSX_PATH = path.resolve(__dirname, "../docs/입고현황.xlsx");

async function login(page: import("@playwright/test").Page) {
  await page.goto("/auth/login");
  await page.getByLabel("이메일").fill(TEST_EMAIL);
  await page.getByLabel("비밀번호").fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "로그인" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/auth/login"));
}

test("실측 PDF+xlsx 업로드 → 분류·정산서 파싱·배치 전환", async ({ page }) => {
  await login(page);
  await page.goto("/protected/upload");

  await page.locator('input[accept=".pdf"]').setInputFiles(PDF_PATH);
  await page.locator('input[accept=".xlsx,.xls"]').setInputFiles(XLSX_PATH);

  const [response] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/ingest") && r.request().method() === "POST"),
    page.getByRole("button", { name: "처리 시작" }).click(),
  ]);

  expect(response.status()).toBe(200);
  const body = await response.json();

  // 분류: 총 15페이지, ACE 경계 검출, p1 정산서/p2-3 세금계산서/p4-7 신고필증
  expect(body.classification.total_pages).toBe(15);
  expect(body.classification.ace_detected).toBe(true);
  const kindOf = (p: number) =>
    body.classification.pages.find((x: { page_index: number }) => x.page_index === p)?.kind;
  expect(kindOf(1)).toBe("settlement");
  expect(kindOf(2)).toBe("tax_invoice");
  expect(kindOf(4)).toBe("declaration");
  expect(kindOf(7)).toBe("declaration");
  expect(kindOf(8)).toBe("skip");

  // 정산서 파싱 필드 정확성
  expect(body.settlement.bl_no).toBe("XMCCLINC26050074");
  expect(body.settlement.duty_amount).toBe(8878190);
  expect(body.settlement.customs_vat).toBe(14520110);
  expect(body.settlement.customs_fee).toBe(50000);
  expect(body.settlement.freight_subtotal).toBe(2758088);
  expect(body.settlement.parsed_ok).toBe(true);
  expect(body.needs_confirmation).toBe(false);

  // 입고현황 xlsx 파싱: 204행 inventory_item (F006)
  expect(body.inventoryCount).toBe(204);

  // 처리 진행 페이지 전환
  await page.waitForURL(/\/protected\/process\/[0-9a-f-]+/);
});

test("미인증 상태로 /protected/upload 접근 시 로그인 리디렉션", async ({ page }) => {
  await page.goto("/protected/upload");
  await expect(page).toHaveURL(/\/auth\/login/);
});
