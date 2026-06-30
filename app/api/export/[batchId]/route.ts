import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";
import { buildEcountXlsx, type EcountRowInput } from "@/lib/export/build-ecount-xlsx";
import { buildValidationReport, type ReportValidation } from "@/lib/export/build-report";
import { OCR_CONFIDENCE_THRESHOLD } from "@/lib/types/constants";
import type { MatchMethod, ValidationType } from "@/lib/types/enums";

export const runtime = "nodejs";

/** 다운로드 허용 게이트 — 검증 3종(㉟=㊶·단가 역산·안분 합계 3칸) 전부 통과 */
const REQUIRED_VALIDATIONS: ValidationType[] = [
  "qty3541",
  "unitprice",
  "alloc_freight",
  "alloc_fee",
  "alloc_etc",
];

interface AllocRow {
  inventory_item_id: string;
  fx_rate: number | null;
  unit_price_krw: number | null;
  supply_amount: number | null;
  vat: number | null;
  bl_no: string | null;
  freight: number | null;
  fee: number | null;
  etc_amount: number | null;
}
interface InvRow {
  id: string;
  row_no: number;
  item_code: string;
  item_name: string;
  qty: number;
  unit_price_fx: number | null;
  currency_code: string;
  in_date: string | null;
}

// GET /api/export/[batchId] — 이카운트 24컬럼 xlsx 생성 + 검증 리포트 (F015, F016, AC-05)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
  const supabase = await createClient();
  const { data: claims, error: authError } = await supabase.auth.getClaims();
  if (authError || !claims?.claims) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  const { batchId } = await params;
  if (!batchId) {
    return NextResponse.json({ error: "batchId가 필요합니다." }, { status: 400 });
  }
  const reportMode = request.nextUrl.searchParams.get("type") === "report";

  // 검증 로그 로드 (RLS로 본인 배치만)
  const { data: logs, error: logsError } = await supabase
    .from("validation_log")
    .select("type, passed, expected, actual")
    .eq("batch_id", batchId);
  if (logsError) {
    return NextResponse.json({ error: "검증 로그를 불러오지 못했습니다." }, { status: 500 });
  }
  const passedByType = new Map<string, boolean>();
  for (const l of logs ?? []) passedByType.set(l.type, l.passed);
  const allPassed = REQUIRED_VALIDATIONS.every((t) => passedByType.get(t) === true);

  // === 검증 리포트 모드 (검증 실패해도 열람 허용) ===
  if (reportMode) {
    const [matchRes, declRes] = await Promise.all([
      supabase
        .from("item_match")
        .select("declaration_item_id, method, status")
        .eq("batch_id", batchId)
        .neq("status", "review"),
      supabase.from("declaration_item").select("page_index, confidence").eq("batch_id", batchId),
    ]);
    if (matchRes.error || declRes.error) {
      return NextResponse.json({ error: "리포트 데이터를 불러오지 못했습니다." }, { status: 500 });
    }

    // 신고 그룹(declaration_item) 단위로 매칭 방법 집계
    const methodByDecl = new Map<string, MatchMethod>();
    for (const m of matchRes.data ?? []) {
      if (m.declaration_item_id) methodByDecl.set(m.declaration_item_id, m.method as MatchMethod);
    }
    const matchCounts: Record<MatchMethod, number> = { code: 0, ai: 0, manual: 0 };
    for (const method of methodByDecl.values()) matchCounts[method] += 1;

    const lowConfidence = (declRes.data ?? [])
      .filter((d) => d.confidence !== null && d.confidence < OCR_CONFIDENCE_THRESHOLD)
      .map((d) => ({ page_index: d.page_index, confidence: d.confidence }));

    const validations: ReportValidation[] = REQUIRED_VALIDATIONS.map((type) => {
      const log = (logs ?? []).find((l) => l.type === type);
      return {
        type,
        passed: log?.passed ?? false,
        expected: log?.expected ?? null,
        actual: log?.actual ?? null,
      };
    });

    const report = buildValidationReport({ validations, matchCounts, lowConfidence });
    return new NextResponse(report, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="report_${batchId}.txt"`,
      },
    });
  }

  // === 이카운트 xlsx 모드 (검증 3종 통과 시에만 허용) ===
  if (!allPassed) {
    return NextResponse.json(
      { error: "검증 3종(㉟=㊶·단가 역산·안분 합계)을 모두 통과해야 다운로드할 수 있습니다." },
      { status: 403 }
    );
  }

  const [allocRes, invRes] = await Promise.all([
    supabase
      .from("allocation_result")
      .select(
        "inventory_item_id, fx_rate, unit_price_krw, supply_amount, vat, bl_no, freight, fee, etc_amount"
      )
      .eq("batch_id", batchId),
    supabase
      .from("inventory_item")
      .select("id, row_no, item_code, item_name, qty, unit_price_fx, currency_code, in_date")
      .eq("batch_id", batchId)
      .order("row_no", { ascending: true }),
  ]);
  if (allocRes.error || invRes.error) {
    return NextResponse.json({ error: "출력 대상 데이터를 불러오지 못했습니다." }, { status: 500 });
  }
  const allocs = (allocRes.data ?? []) as AllocRow[];
  const invs = (invRes.data ?? []) as InvRow[];
  if (allocs.length === 0) {
    return NextResponse.json(
      { error: "안분 결과가 없습니다. 먼저 안분을 실행하세요." },
      { status: 422 }
    );
  }

  const allocByInv = new Map<string, AllocRow>(allocs.map((a) => [a.inventory_item_id, a]));

  // 입고현황 원본 순서(row_no)로 행 조립 — 안분 결과가 있는 행만 출력
  const rows: EcountRowInput[] = [];
  for (const inv of invs) {
    const alloc = allocByInv.get(inv.id);
    if (!alloc) continue;
    rows.push({
      in_date: inv.in_date,
      item_code: inv.item_code,
      item_name: inv.item_name,
      qty: inv.qty,
      unit_price_fx: inv.unit_price_fx,
      currency_code: inv.currency_code,
      fx_rate: alloc.fx_rate,
      unit_price_krw: alloc.unit_price_krw,
      supply_amount: alloc.supply_amount,
      vat: alloc.vat,
      bl_no: alloc.bl_no,
      freight: alloc.freight,
      fee: alloc.fee,
      etc_amount: alloc.etc_amount,
    });
  }

  const buffer = buildEcountXlsx(rows);
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="ecount_${batchId}.xlsx"`,
    },
  });
}
