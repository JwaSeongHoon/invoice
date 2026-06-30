import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";
import {
  runCodeMatch,
  groupInventoryByKey,
  type DeclInput,
  type InvInput,
} from "@/lib/matching/match-engine";
import { compareQty } from "@/lib/matching/compare-qty";
import { matchSemantic, MissingApiKeyError } from "@/lib/matching/anthropic";
import { AI_MATCH_THRESHOLD, AI_MATCH_GAP_THRESHOLD } from "@/lib/types/constants";
import type { MatchGroupCandidate, MatchReviewItem } from "@/lib/types/domain";
import type { MatchMethod, MatchStatus } from "@/lib/types/enums";

export const runtime = "nodejs";

interface DeclRow {
  id: string;
  model: string | null;
  qty_35: number | null;
}
interface InvRow {
  id: string;
  item_code: string;
  item_name: string;
  qty: number;
}
interface ItemMatchInsert {
  batch_id: string;
  declaration_item_id: string;
  inventory_item_id: string;
  method: MatchMethod;
  score: number | null;
  status: MatchStatus;
}

/** 신고별 배정 입고 그룹 (코드/AI/수동) */
interface Assignment {
  inv_ids: string[];
  status: MatchStatus;
  method: MatchMethod;
  score: number | null;
}

/** 미배정 입고 → 점수 0 fallback 후보 그룹 */
function fallbackCandidates(unassigned: InvInput[]): MatchGroupCandidate[] {
  return groupInventoryByKey(unassigned).map((g) => ({
    inventory_key: g.inventory_key,
    item_name: g.item_name,
    qty_sum: g.qty_sum,
    row_count: g.row_count,
    score: 0,
    reason: "후보(점수 미저장)",
  }));
}

/** 신고 그룹 단위 검토 행 조립 */
function buildItems(
  declarations: DeclRow[],
  invById: Map<string, InvRow>,
  assignmentByDecl: Map<string, Assignment>,
  candidatesByDecl: Map<string, MatchGroupCandidate[]>,
  fallback: MatchGroupCandidate[]
): MatchReviewItem[] {
  return declarations.map((d) => {
    const a = assignmentByDecl.get(d.id);
    if (a && a.inv_ids.length > 0) {
      const invs = a.inv_ids
        .map((id) => invById.get(id))
        .filter((v): v is InvRow => v !== undefined);
      return {
        declaration_item_id: d.id,
        model: d.model,
        decl_qty: d.qty_35,
        inv_qty: invs.reduce((s, i) => s + i.qty, 0),
        item_name: invs[0]?.item_name ?? null,
        inv_count: invs.length,
        method: a.method,
        status: a.status,
        score: a.score,
      };
    }
    return {
      declaration_item_id: d.id,
      model: d.model,
      decl_qty: d.qty_35,
      inv_qty: null,
      item_name: null,
      inv_count: 0,
      method: null,
      status: "review",
      score: null,
      candidates: candidatesByDecl.get(d.id) ?? fallback,
    };
  });
}

// POST /api/match — 코드 매칭(1순위) → AI 의미매칭(2순위) → 신고 그룹별 후보 반환 (F007, F008, F010, AC-02)
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

  // 신고필증·입고현황 로드 (RLS로 본인 배치만)
  const [declRes, invRes] = await Promise.all([
    supabase.from("declaration_item").select("id, model, qty_35").eq("batch_id", batchId),
    supabase.from("inventory_item").select("id, item_code, item_name, qty").eq("batch_id", batchId),
  ]);
  if (declRes.error || invRes.error) {
    return NextResponse.json({ error: "매칭 대상 데이터를 불러오지 못했습니다." }, { status: 500 });
  }
  const declRows: DeclRow[] = declRes.data ?? [];
  const invRows: InvRow[] = invRes.data ?? [];
  if (declRows.length === 0) {
    return NextResponse.json(
      { error: "신고필증 OCR 결과가 없습니다. 먼저 처리를 완료하세요." },
      { status: 422 }
    );
  }
  if (invRows.length === 0) {
    return NextResponse.json({ error: "입고현황 데이터가 없습니다." }, { status: 422 });
  }

  const invById = new Map<string, InvRow>(invRows.map((i) => [i.id, i]));
  const inventories: InvInput[] = invRows.map((i) => ({
    id: i.id,
    item_code: i.item_code,
    item_name: i.item_name,
    qty: i.qty,
  }));

  // 비파괴 멱등: 기존 item_match가 있으면 재계산 없이 저장된 배정으로 복원 (수동 확정 보존)
  const { data: existing } = await supabase
    .from("item_match")
    .select("declaration_item_id, inventory_item_id, method, score, status")
    .eq("batch_id", batchId);
  if (existing && existing.length > 0) {
    const assignmentByDecl = new Map<string, Assignment>();
    const assignedInvIds = new Set<string>();
    for (const row of existing) {
      if (!row.declaration_item_id || !row.inventory_item_id) continue;
      assignedInvIds.add(row.inventory_item_id);
      const cur = assignmentByDecl.get(row.declaration_item_id) ?? {
        inv_ids: [],
        status: row.status as MatchStatus,
        method: row.method as MatchMethod,
        score: row.score,
      };
      cur.inv_ids.push(row.inventory_item_id);
      assignmentByDecl.set(row.declaration_item_id, cur);
    }
    const fallback = fallbackCandidates(inventories.filter((i) => !assignedInvIds.has(i.id)));
    const items = buildItems(declRows, invById, assignmentByDecl, new Map(), fallback);
    return NextResponse.json({ items }, { status: 200 });
  }

  // 신규 계산: 코드 매칭(1순위)
  const decls: DeclInput[] = declRows.map((d) => ({ id: d.id, model: d.model, qty_35: d.qty_35 }));
  const { assignments, unmatchedDecls } = runCodeMatch(decls, inventories);

  const assignmentByDecl = new Map<string, Assignment>();
  const insertRows: ItemMatchInsert[] = [];
  for (const a of assignments) {
    assignmentByDecl.set(a.declaration_item_id, {
      inv_ids: a.inventory_item_ids,
      status: a.status,
      method: "code",
      score: 1,
    });
    for (const invId of a.inventory_item_ids) {
      insertRows.push({
        batch_id: batchId,
        declaration_item_id: a.declaration_item_id,
        inventory_item_id: invId,
        method: "code",
        score: 1,
        status: a.status,
      });
    }
  }

  // AI 의미 매칭(2순위): 코드 미매칭 신고만, 미배정 입고 그룹 후보
  const candidatesByDecl = new Map<string, MatchGroupCandidate[]>();
  const usedKeys = new Set<string>();
  for (const decl of unmatchedDecls) {
    const assignedInvIds = new Set<string>();
    for (const a of assignmentByDecl.values()) a.inv_ids.forEach((id) => assignedInvIds.add(id));
    const groups = groupInventoryByKey(inventories.filter((i) => !assignedInvIds.has(i.id))).filter(
      (g) => !usedKeys.has(g.inventory_key)
    );

    if (!decl.model || groups.length === 0) continue;

    let scores;
    try {
      scores = await matchSemantic(
        decl.model,
        groups.map((g) => ({ inventory_key: g.inventory_key, item_name: g.item_name }))
      );
    } catch (error) {
      if (error instanceof MissingApiKeyError) {
        return NextResponse.json(
          { error: "Claude API 키가 설정되지 않아 의미 매칭을 수행할 수 없습니다." },
          { status: 500 }
        );
      }
      return NextResponse.json({ error: "AI 의미 매칭 중 오류가 발생했습니다." }, { status: 502 });
    }

    const groupByKey = new Map(groups.map((g) => [g.inventory_key, g]));
    const cands: MatchGroupCandidate[] = scores.map((s) => {
      const g = groupByKey.get(s.inventory_key);
      return {
        inventory_key: s.inventory_key,
        item_name: g?.item_name ?? s.inventory_key,
        qty_sum: g?.qty_sum ?? 0,
        row_count: g?.row_count ?? 0,
        score: s.score,
        reason: s.reason,
      };
    });

    const top = cands[0];
    const second = cands[1];
    const autoConfirm =
      top !== undefined &&
      top.score >= AI_MATCH_THRESHOLD &&
      (second === undefined || top.score - second.score >= AI_MATCH_GAP_THRESHOLD);

    const grp = top ? groupByKey.get(top.inventory_key) : undefined;
    if (autoConfirm && grp) {
      usedKeys.add(grp.inventory_key);
      const status = compareQty(decl.qty_35, grp.qty_sum);
      assignmentByDecl.set(decl.id, {
        inv_ids: grp.inventory_item_ids,
        status,
        method: "ai",
        score: top.score,
      });
      for (const invId of grp.inventory_item_ids) {
        insertRows.push({
          batch_id: batchId,
          declaration_item_id: decl.id,
          inventory_item_id: invId,
          method: "ai",
          score: top.score,
          status,
        });
      }
    } else {
      candidatesByDecl.set(decl.id, cands);
    }
  }

  if (insertRows.length > 0) {
    const { error: insertError } = await supabase.from("item_match").insert(insertRows);
    if (insertError) {
      return NextResponse.json({ error: "매칭 결과 저장에 실패했습니다." }, { status: 500 });
    }
  }

  const assignedInvIds = new Set<string>();
  for (const a of assignmentByDecl.values()) a.inv_ids.forEach((id) => assignedInvIds.add(id));
  const fallback = fallbackCandidates(inventories.filter((i) => !assignedInvIds.has(i.id)));
  const items = buildItems(declRows, invById, assignmentByDecl, candidatesByDecl, fallback);
  return NextResponse.json({ items }, { status: 200 });
}
