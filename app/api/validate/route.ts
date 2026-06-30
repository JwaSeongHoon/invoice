import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";
import { validateQty, QTY_MISMATCH_MESSAGE } from "@/lib/validation/qty";

export const runtime = "nodejs";

// POST /api/validate — ㉟=㊶ 수량 검증, validation_log 기록 (F005, AC-01)
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: claims, error: authError } = await supabase.auth.getClaims();
  if (authError || !claims?.claims) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { batchId?: string } | null;
  const batchId = body?.batchId;
  if (!batchId) {
    return NextResponse.json({ error: "batchId가 필요합니다." }, { status: 400 });
  }

  // 신고필증 라인 조회 (RLS로 본인 배치만)
  const { data: items, error: itemsError } = await supabase
    .from("declaration_item")
    .select("page_index, qty_35, qty_41_total")
    .eq("batch_id", batchId);
  if (itemsError) {
    return NextResponse.json({ error: "신고필증 데이터를 불러오지 못했습니다." }, { status: 500 });
  }
  if (!items || items.length === 0) {
    return NextResponse.json(
      { error: "신고필증 OCR 결과가 없습니다. 먼저 OCR을 실행하세요." },
      { status: 422 }
    );
  }

  // ㉟=㊶ 검증
  const result = validateQty(items);
  const message = result.passed ? null : QTY_MISMATCH_MESSAGE;

  // validation_log 기록 (멱등성: 동일 type 기존 로그 제거 후 기록)
  await supabase.from("validation_log").delete().eq("batch_id", batchId).eq("type", "qty3541");
  await supabase.from("validation_log").insert({
    batch_id: batchId,
    type: "qty3541",
    passed: result.passed,
    expected: result.expected,
    actual: result.actual,
    message,
  });

  // 통과 시에만 매칭 단계 진입 허용 (status → matching)
  if (result.passed) {
    await supabase.from("import_batch").update({ status: "matching" }).eq("id", batchId);
  }

  return NextResponse.json(
    {
      passed: result.passed,
      expected: result.expected,
      actual: result.actual,
      message,
    },
    { status: 200 }
  );
}
