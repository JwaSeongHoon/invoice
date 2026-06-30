import { test, expect, type APIResponse, type Page, type Response } from "@playwright/test";
import path from "path";

/**
 * Task 019 — 실측 데이터 풀 플로우 통합 E2E + 수용 기준 AC-01~AC-06 전수 검증
 *
 * 업로드 → PDF 분류·OCR·정산서 파싱 → 수량 검증(㉟=㊶) → 코드·AI 매칭 →
 * 부대비용 안분·환율 환산 → 이카운트 24컬럼 양식·검증 리포트 다운로드까지
 * 단일 배치로 끝까지 진행하며 AC-01~AC-06을 모두 assert한다.
 *
 * 참고: 실 Claude Vision OCR(수십 초)·환율 외부소스에 의존하므로 ANTHROPIC_API_KEY가
 * 설정된 환경에서만 실행하고, 미설정 시 전체 스킵한다(process.spec.ts와 동일 정책).
 * 느린 통합 테스트이므로 제목에 @slow 태그를 부여한다.
 */

const TEST_EMAIL = "qa-ingest@invoice.test";
const TEST_PASSWORD = "password123";
const PDF_PATH = path.resolve(__dirname, "../docs/최종정산서_XMCCLINC26050074.pdf");
const XLSX_PATH = path.resolve(__dirname, "../docs/입고현황.xlsx");
const ECOUNT_SHEET = "이카운트업로드";

const HAS_OCR_KEY = Boolean(process.env.ANTHROPIC_API_KEY);

async function login(page: Page) {
  await page.goto("/auth/login");
  await page.getByLabel("이메일").fill(TEST_EMAIL);
  await page.getByLabel("비밀번호").fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "로그인" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/auth/login"));
}

/** 확인요(review) 매칭 행이 남아 있으면 후보 첫 항목으로 1클릭 확정한다(AI 매칭 잔여 대비). */
async function confirmRemainingReviews(page: Page) {
  // "확정" 버튼은 status==='review' 행에만 렌더된다. 모두 사라질 때까지 반복.
  for (let guard = 0; guard < 30; guard += 1) {
    const confirmButtons = page.getByRole("button", { name: "확정" });
    if ((await confirmButtons.count()) === 0) return;

    // 첫 review 행의 입고 그룹 Select(combobox)를 열어 첫 후보를 선택한다.
    await page
      .getByRole("combobox", { name: /입고 그룹 선택/ })
      .first()
      .click()
      .catch(async () => {
        await page.getByText("입고 그룹 선택").first().click();
      });
    await page.getByRole("option").first().click();

    const [res] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes("/api/match/") && r.request().method() === "PATCH"
      ),
      confirmButtons.first().click(),
    ]);
    expect(res.status()).toBe(200);
  }
  throw new Error("확인요 매칭 확정 루프가 30회를 초과했습니다.");
}

test.describe("실측 풀 플로우 + AC 전수 검증 @slow", () => {
  test.skip(!HAS_OCR_KEY, "ANTHROPIC_API_KEY 미설정 — 실 OCR 풀 플로우 스킵");
  test.setTimeout(240_000);

  test("업로드→매칭→안분→다운로드 전 과정 + AC-01~AC-06", async ({ page }) => {
    const startedAt = Date.now();
    let batchId = "";
    // page.waitForResponse는 네트워크 Response를, page.request.*는 APIResponse를 반환한다.
    let matchRes: Response | undefined;
    let allocResP: Promise<Response> | undefined;

    // ── 1단계: 업로드 → 분류·정산서 파싱·입고 파싱 (ingest)
    await test.step("업로드·분류·파싱 (ingest)", async () => {
      await login(page);
      await page.goto("/protected/upload");
      await page.locator('input[accept=".pdf"]').setInputFiles(PDF_PATH);
      await page.locator('input[accept=".xlsx,.xls"]').setInputFiles(XLSX_PATH);

      const [res] = await Promise.all([
        page.waitForResponse(
          (r) => r.url().includes("/api/ingest") && r.request().method() === "POST"
        ),
        page.getByRole("button", { name: "처리 시작" }).click(),
      ]);
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.settlement.bl_no).toBe("XMCCLINC26050074");
      expect(body.inventoryCount).toBe(204);

      await page.waitForURL(/\/protected\/process\/[0-9a-f-]+/);
      batchId = page.url().match(/process\/([0-9a-f-]+)/)![1];
    });

    // ── 2단계: OCR → 수량 검증(AC-01) → 매칭 자동 전환
    //   AC-01(㉟=㊶): 처리 페이지는 수량 검증 통과 시에만 매칭 페이지로 전환된다.
    //   매칭 페이지 도달 자체가 qty3541 검증 게이트 통과를 의미한다(불일치 시 진행 차단).
    //   매칭 페이지 진입 시 자동 발생하는 POST /api/match를 캡처한다(AI 매칭 포함 ~수십 초).
    await test.step("OCR·수량 검증(AC-01) → 매칭 자동 전환", async () => {
      const matchResP = page.waitForResponse(
        (r) => r.url().includes("/api/match") && r.request().method() === "POST",
        { timeout: 180_000 }
      );
      await page.waitForURL(new RegExp(`/protected/match/${batchId}`), { timeout: 150_000 });
      await expect(page.getByRole("heading", { name: "매칭 검토" })).toBeVisible();
      matchRes = await matchResP;
      expect(matchRes.status()).toBe(200);
    });

    // ── 3단계: 코드·AI 매칭 (AC-02) → 안분 페이지 이동
    await test.step("코드 매칭 method=code (AC-02) → 결과 생성", async () => {
      const body = (await matchRes!.json()) as {
        items: { method: string | null; status: string }[];
      };
      // AC-02: 코드 앞 10자리 일치 건은 method='code'로 자동 매칭된다.
      expect(body.items.some((it) => it.method === "code")).toBe(true);

      // 확인요(review)가 있으면 "결과 생성" 버튼이 비활성이어야 한다(차단 불변식).
      const hasReview = body.items.some((it) => it.status === "review");
      if (hasReview) {
        await expect(page.getByRole("button", { name: "결과 생성" })).toBeDisabled();
        await confirmRemainingReviews(page);
      }
      // 모든 항목 확정 후 결과 생성 버튼 활성화 → 안분 페이지 이동
      await expect(page.getByRole("button", { name: "결과 생성" })).toBeEnabled();
      // 안분 페이지 진입 시 자동 발생하는 POST /api/allocate를 캡처할 준비를 먼저 한다.
      allocResP = page.waitForResponse(
        (r) => r.url().includes("/api/allocate") && r.request().method() === "POST",
        { timeout: 120_000 }
      );
      await page.getByRole("button", { name: "결과 생성" }).click();
      await page.waitForURL(new RegExp(`/protected/allocate/${batchId}`));
    });

    // ── 4단계: 안분·환율 (AC-04 환율 폴백·수동 오버라이드, AC-03 안분 합계)
    //   /api/allocate는 외부 소스를 직접 호출하지 않고 fx_rate_cache만 읽는다. 테스트 환경엔
    //   환율 외부소스(FX_HANA/SMBS)가 없으므로 최초 안분은 422(needsManual)로 환율 부재를 알린다.
    //   이것이 AC-04의 수동 오버라이드 폴백 경로다 — 수동 환율을 입력(/api/fx)한 뒤 안분을 재시도해
    //   200을 받는다. (외부소스가 설정된 환경에서는 최초 호출이 곧바로 200이 된다.)
    await test.step("환율 폴백·수동 입력(AC-04) → 안분 합계 검증(AC-03)", async () => {
      let allocRes: Response | APIResponse = await allocResP!;
      if (allocRes.status() === 422) {
        const err = (await allocRes.json()) as { error?: string; needsManual?: boolean };
        // 미보유 환율 키 추출(예: "USD 2026-05-08") 후 통화별 수동 환율 입력
        const pairs = [...String(err.error ?? "").matchAll(/(USD|CNY)\s+(\d{4}-\d{2}-\d{2})/g)];
        expect(pairs.length, "422 응답에서 미보유 환율 키를 찾지 못함").toBeGreaterThan(0);
        for (const [, currency, date] of pairs) {
          const manualRate = currency === "CNY" ? 190 : 1350;
          const fxRes = await page.request.post("/api/fx", {
            data: { date, currency, manualRate },
          });
          expect(fxRes.status()).toBe(200);
          // AC-04: 수동 입력 환율은 source='manual'로 기록된다.
          expect((await fxRes.json()).source).toBe("manual");
        }
        // 환율 입력 후 안분 재시도 → 200
        allocRes = await page.request.post("/api/allocate", { data: { batchId } });
      }
      expect(allocRes.status()).toBe(200);

      const body = (await allocRes.json()) as {
        validations: { type: string; passed: boolean; expected: number; actual: number }[];
        fxSources: { currency: string; source: string }[];
        rows: { alloc_basis: string }[];
      };

      // AC-03: 운반비·수수료·기타 안분 합계 == 정산서 칸 총액(기대=실제, 통과)
      for (const type of ["alloc_freight", "alloc_fee", "alloc_etc"]) {
        const v = body.validations.find((x) => x.type === type);
        expect(v, `${type} 검증 누락`).toBeTruthy();
        expect(v!.passed).toBe(true);
        expect(v!.actual).toBe(v!.expected);
      }
      // 단가 역산 보정(unitprice)도 통과해야 한다.
      const unit = body.validations.find((x) => x.type === "unitprice");
      expect(unit?.passed).toBe(true);

      // AC-04: 환율 출처는 하나은행→서울외환→수동 중 하나로 기록된다.
      expect(Array.isArray(body.fxSources)).toBe(true);
      expect(body.fxSources.length).toBeGreaterThan(0);
      for (const fx of body.fxSources) {
        expect(["hana", "smbs", "manual"]).toContain(fx.source);
      }
      // 안분 기준은 신고수량(decl)/입고수량(inventory) 중 하나.
      for (const row of body.rows) {
        expect(["decl", "inventory"]).toContain(row.alloc_basis);
      }

      // 결과(다운로드) 페이지로 이동 — 안분 데이터 영속화 후 결과 페이지는 DB에서 조립한다.
      await page.goto(`/protected/result/${batchId}`);
      await page.waitForURL(new RegExp(`/protected/result/${batchId}`));
    });

    // ── 5단계: 이카운트 24컬럼 양식(AC-05) + OCR 저신뢰 리포트(AC-06)
    await test.step("이카운트 24컬럼 양식(AC-05)·검증 리포트/저신뢰(AC-06)", async () => {
      // AC-05: 다운로드 게이트(검증 5종) 통과 시 xlsx 200 응답, 24컬럼 헤더 동일.
      const xlsxRes = await page.request.get(`/api/export/${batchId}`);
      expect(xlsxRes.status()).toBe(200);
      expect(xlsxRes.headers()["content-type"]).toContain("spreadsheetml.sheet");
      expect(xlsxRes.headers()["content-disposition"]).toContain(`ecount_${batchId}.xlsx`);

      // xlsx는 최상위 import 시 테스트 수집 단계에서 충돌하므로 런타임 동적 로드한다.
      const XLSX = await import("xlsx");
      const wb = XLSX.read(await xlsxRes.body(), { type: "buffer" });
      const ws = wb.Sheets[ECOUNT_SHEET];
      expect(ws, "이카운트업로드 시트 누락").toBeTruthy();
      const grid = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 });
      const header = grid[0];
      expect(header).toHaveLength(24);
      expect(header[0]).toBe("일자");
      expect(header[7]).toBe("통화");
      expect(header[14]).toBe("단가");

      // AC-06: 검증 리포트는 게이트와 무관하게 열람 가능하며 OCR 저신뢰 섹션을 포함한다.
      const repRes = await page.request.get(`/api/export/${batchId}?type=report`);
      expect(repRes.status()).toBe(200);
      expect(repRes.headers()["content-type"]).toContain("text/plain");
      const report = await repRes.text();
      expect(report).toContain("=== 수입정산 검증 리포트 ===");
      expect(report).toContain("[검증 결과]");
      expect(report).toContain("[매칭 방법 요약]");
      // confidence < 0.85 저신뢰 목록 섹션 존재(AC-06)
      expect(report).toContain("[OCR 저신뢰 목록 (confidence < 0.85)]");
    });

    // ── 성능 측정: 처리 60초 이내 목표(OI-5). 환경 편차가 크므로 로깅·소프트 체크.
    const elapsedMs = Date.now() - startedAt;
    console.log(
      `[full-flow] 업로드→다운로드 총 소요: ${(elapsedMs / 1000).toFixed(1)}초 (목표 60초)`
    );
  });
});

test.describe("풀 플로우 엣지·보안 게이트", () => {
  // AC 차단 불변식: 미인증 사용자는 보호 라우트(export)에 접근할 수 없다.
  // 미들웨어가 미인증 요청을 /auth/login으로 리디렉션한다(리디렉션을 따르지 않고 상태로 검증).
  test("미인증 export 요청 차단", async ({ page }) => {
    const res = await page.request.get("/api/export/00000000-0000-0000-0000-000000000000", {
      maxRedirects: 0,
    });
    expect([301, 302, 303, 307, 308]).toContain(res.status());
    expect(res.headers()["location"]).toContain("/auth/login");
  });
});
