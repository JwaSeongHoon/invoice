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

/** AI 의미 매칭 LLM 호출의 최대 동시 실행 수 (rate limit 보호). */
const SEMANTIC_MATCH_CONCURRENCY = 6;

/**
 * items를 최대 limit개씩 동시 실행하며 fn을 적용하고, 입력 순서를 보존한 결과 배열을 반환한다.
 * 하나라도 reject되면 즉시 전체가 reject된다(기존 순차 로직의 즉시 실패 동작 유지).
 */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  async function worker(): Promise<void> {
    while (next < items.length) {
      const current = next++;
      results[current] = await fn(items[current]);
    }
  }
  const workerCount = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

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

  // 비파괴 멱등: 기존 매칭 결과가 있으면 재계산(LLM 호출) 없이 복원한다.
  // - item_match: 확정(code/ai/manual) 배정 (수동 확정 보존)
  // - match_candidate: review 신고의 AI 후보 점수·근거 캐시 → 재로딩 시 LLM 재호출 방지(B)
  const [existingRes, cachedCandRes] = await Promise.all([
    supabase
      .from("item_match")
      .select("declaration_item_id, inventory_item_id, method, score, status")
      .eq("batch_id", batchId),
    supabase
      .from("match_candidate")
      .select("declaration_item_id, inventory_key, score, reason")
      .eq("batch_id", batchId),
  ]);
  const existing = existingRes.data;
  const cachedCandidates = cachedCandRes.data ?? [];
  if ((existing && existing.length > 0) || cachedCandidates.length > 0) {
    const assignmentByDecl = new Map<string, Assignment>();
    const assignedInvIds = new Set<string>();
    for (const row of existing ?? []) {
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

    // review 후보 복원: 그룹 정보(item_name/qty_sum/row_count)는 현재 입고로 재계산하고,
    // 캐시의 score·reason만 결합한다. 이미 배정된 입고 그룹은 후보에서 자연히 제외된다.
    const unassigned = inventories.filter((i) => !assignedInvIds.has(i.id));
    const groupByKey = new Map(groupInventoryByKey(unassigned).map((g) => [g.inventory_key, g]));
    const candidatesByCache = new Map<string, MatchGroupCandidate[]>();
    for (const c of cachedCandidates) {
      const g = groupByKey.get(c.inventory_key);
      if (!g) continue;
      const list = candidatesByCache.get(c.declaration_item_id) ?? [];
      list.push({
        inventory_key: c.inventory_key,
        item_name: g.item_name,
        qty_sum: g.qty_sum,
        row_count: g.row_count,
        score: c.score,
        reason: c.reason,
      });
      candidatesByCache.set(c.declaration_item_id, list);
    }
    for (const list of candidatesByCache.values()) list.sort((a, b) => b.score - a.score);

    const fallback = fallbackCandidates(unassigned);
    const items = buildItems(declRows, invById, assignmentByDecl, candidatesByCache, fallback);
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

  // 코드 매칭에 배정되지 않은 입고로 후보 그룹을 1회만 구성 (LLM 병렬 호출용 공통 후보군).
  // 그룹은 inventory_key 단위로 결정론적이라, 이후 다른 신고가 선점한 그룹은 usedKeys로만 제외하면 된다.
  const codeAssignedInvIds = new Set<string>();
  for (const a of assignmentByDecl.values()) a.inv_ids.forEach((id) => codeAssignedInvIds.add(id));
  const baseGroups = groupInventoryByKey(inventories.filter((i) => !codeAssignedInvIds.has(i.id)));
  const baseGroupByKey = new Map(baseGroups.map((g) => [g.inventory_key, g]));

  // LLM 호출은 신고 건별로 병렬 실행(순차 await 대기 제거). 그리디 배정은 이후 순차로 처리한다.
  const semanticTargets = unmatchedDecls.filter(
    (d): d is DeclInput & { model: string } => Boolean(d.model) && baseGroups.length > 0
  );
  const semanticGroupInput = baseGroups.map((g) => ({
    inventory_key: g.inventory_key,
    item_name: g.item_name,
  }));
  let semanticResults: Array<{ id: string; scores: Awaited<ReturnType<typeof matchSemantic>> }>;
  try {
    semanticResults = await mapWithConcurrency(
      semanticTargets,
      SEMANTIC_MATCH_CONCURRENCY,
      async (decl) => ({
        id: decl.id,
        scores: await matchSemantic(decl.model, semanticGroupInput),
      })
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
  const scoresByDecl = new Map(semanticResults.map((r) => [r.id, r.scores]));

  // 그리디 배정: 원래 순서를 유지하며, 앞선 신고가 선점한 그룹(usedKeys)은 제외하고 상위 후보를 선정한다.
  for (const decl of unmatchedDecls) {
    const rawScores = scoresByDecl.get(decl.id);
    if (!rawScores) continue;

    // 아직 사용되지 않은 그룹만 후보로 남긴다(점수 내림차순 정렬은 그대로 보존).
    const cands: MatchGroupCandidate[] = rawScores
      .filter((s) => {
        const g = baseGroupByKey.get(s.inventory_key);
        return g !== undefined && !usedKeys.has(g.inventory_key);
      })
      .map((s) => {
        const g = baseGroupByKey.get(s.inventory_key);
        return {
          inventory_key: s.inventory_key,
          item_name: g?.item_name ?? s.inventory_key,
          qty_sum: g?.qty_sum ?? 0,
          row_count: g?.row_count ?? 0,
          score: s.score,
          reason: s.reason,
        };
      });

    if (cands.length === 0) continue;

    const top = cands[0];
    const second = cands[1];
    const grp = top ? baseGroupByKey.get(top.inventory_key) : undefined;
    // 수량이 일치할 때만 자동확정한다. 이름 점수가 높아도 수량이 어긋나면(예: 신고 2432 vs
    // 입고 32 — 실제로는 다른 입고 그룹과 합쳐져야 하는 경우) 오배정 위험이 크므로 확인요로 남긴다.
    const status = grp ? compareQty(decl.qty_35, grp.qty_sum) : "mismatch";
    const autoConfirm =
      top !== undefined &&
      grp !== undefined &&
      status === "match" &&
      top.score >= AI_MATCH_THRESHOLD &&
      (second === undefined || top.score - second.score >= AI_MATCH_GAP_THRESHOLD);

    if (autoConfirm && grp) {
      usedKeys.add(grp.inventory_key);
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

  // review 후보(AI 점수·근거)를 캐시에 저장한다. 다음 재로딩 시 LLM 재호출 없이 복원된다(B).
  // 캐시 저장 실패는 기능상 치명적이지 않으므로(다음 로딩이 느려질 뿐) 응답을 막지 않는다.
  const candidateInsertRows = [...candidatesByDecl.entries()].flatMap(([declId, cands]) =>
    cands.map((c) => ({
      batch_id: batchId,
      declaration_item_id: declId,
      inventory_key: c.inventory_key,
      score: c.score,
      reason: c.reason,
    }))
  );
  if (candidateInsertRows.length > 0) {
    await supabase.from("match_candidate").insert(candidateInsertRows);
  }

  const assignedInvIds = new Set<string>();
  for (const a of assignmentByDecl.values()) a.inv_ids.forEach((id) => assignedInvIds.add(id));
  const fallback = fallbackCandidates(inventories.filter((i) => !assignedInvIds.has(i.id)));
  const items = buildItems(declRows, invById, assignmentByDecl, candidatesByDecl, fallback);
  return NextResponse.json({ items }, { status: 200 });
}
