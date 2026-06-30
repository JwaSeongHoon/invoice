import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";
import { inventoryMatchKey } from "@/lib/matching/normalize";
import { compareQty } from "@/lib/matching/compare-qty";

export const runtime = "nodejs";

// PATCH /api/match/[id] — "확인요" 신고 모델에 입고 그룹을 수동 확정 (method=manual) (F009)
// [id] = declaration_item_id, body = { inventory_key } (입고 키 그룹 전체를 배정)
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: claims, error: authError } = await supabase.auth.getClaims();
  if (authError || !claims?.claims) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  const userId = claims.claims.sub;

  const { id: declarationItemId } = await params;
  const body = (await request.json().catch(() => null)) as { inventory_key?: string } | null;
  const inventoryKey = body?.inventory_key;
  if (!inventoryKey) {
    return NextResponse.json({ error: "확정할 입고 그룹을 선택하세요." }, { status: 400 });
  }

  // 신고 라인 조회 (RLS로 본인 배치만 — 없으면 404로 비소유자 차단)
  const { data: decl, error: declError } = await supabase
    .from("declaration_item")
    .select("id, batch_id, qty_35")
    .eq("id", declarationItemId)
    .maybeSingle();
  if (declError) {
    return NextResponse.json({ error: "신고 데이터를 불러오지 못했습니다." }, { status: 500 });
  }
  if (!decl) {
    return NextResponse.json(
      { error: "신고 항목을 찾을 수 없거나 접근 권한이 없습니다." },
      { status: 404 }
    );
  }

  // 입고 그룹(키 일치) 조회
  const { data: invRows, error: invError } = await supabase
    .from("inventory_item")
    .select("id, item_code, qty")
    .eq("batch_id", decl.batch_id);
  if (invError) {
    return NextResponse.json({ error: "입고 데이터를 불러오지 못했습니다." }, { status: 500 });
  }
  const groupRows = (invRows ?? []).filter((i) => inventoryMatchKey(i.item_code) === inventoryKey);
  if (groupRows.length === 0) {
    return NextResponse.json({ error: "해당 입고 그룹을 찾을 수 없습니다." }, { status: 400 });
  }

  const qtySum = groupRows.reduce((s, i) => s + i.qty, 0);
  const status = compareQty(decl.qty_35, qtySum);

  // 재배정 안전: 이 신고의 기존 매칭 + 대상 입고 행의 기존 매칭 제거 후 수동 배정 삽입
  const groupInvIds = groupRows.map((i) => i.id);
  await supabase
    .from("item_match")
    .delete()
    .eq("batch_id", decl.batch_id)
    .eq("declaration_item_id", declarationItemId);
  await supabase
    .from("item_match")
    .delete()
    .eq("batch_id", decl.batch_id)
    .in("inventory_item_id", groupInvIds);

  const rows = groupInvIds.map((invId) => ({
    batch_id: decl.batch_id,
    declaration_item_id: declarationItemId,
    inventory_item_id: invId,
    method: "manual" as const,
    score: null,
    status,
    confirmed_by: userId,
  }));
  const { error: insertError } = await supabase.from("item_match").insert(rows);
  if (insertError) {
    return NextResponse.json({ error: "매칭 확정에 실패했습니다." }, { status: 500 });
  }

  return NextResponse.json(
    { declaration_item_id: declarationItemId, status, inv_count: rows.length },
    { status: 200 }
  );
}
