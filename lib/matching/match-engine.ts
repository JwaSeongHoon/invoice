import { inventoryMatchKey, declarationKeys } from "@/lib/matching/normalize";
import { compareQty } from "@/lib/matching/compare-qty";
import type { MatchStatus } from "@/lib/types/enums";

/**
 * 코드 매칭 오케스트레이션 (F007, F010, F011, AC-02) — DB 비의존 순수 로직
 *
 * 실측 데이터 구조: 신고 1건(모델) : 입고 N건(색상·사이즈 SKU). 입고 품목코드 앞
 * 10자리(정규화)를 키로, 신고 model의 공백 토큰(정규화)과 일치시킨다. 하나의 키를
 * 두 신고가 공유하면(중복 모델번호) 모호하므로 코드 자동 매칭에서 제외한다.
 *
 * 수량 비교(F010)는 그룹 단위: Σ(그룹 입고수량) vs 신고수량(㉟).
 */

/** 코드 매칭 입력 — 신고필증 라인 */
export interface DeclInput {
  id: string;
  model: string | null;
  qty_35: number | null;
}

/** 코드 매칭 입력 — 입고 품목 */
export interface InvInput {
  id: string;
  item_code: string;
  item_name: string;
  qty: number;
}

/** 신고 1건에 배정된 입고 그룹 */
export interface GroupAssignment {
  declaration_item_id: string;
  inventory_item_ids: string[];
  inv_qty_sum: number;
  /** 그룹 수량 비교 결과 (match | mismatch) */
  status: Extract<MatchStatus, "match" | "mismatch">;
}

export interface CodeMatchResult {
  /** 코드로 고유 배정된 신고 그룹 */
  assignments: GroupAssignment[];
  /** 코드 미매칭·모호로 미배정된 신고 (AI/수동 대상) */
  unmatchedDecls: DeclInput[];
  /** 어느 신고에도 배정되지 않은 입고 품목 (AI/수동 후보 풀) */
  unassignedInv: InvInput[];
}

export function runCodeMatch(declarations: DeclInput[], inventories: InvInput[]): CodeMatchResult {
  // 입고 키 → 입고 품목 그룹
  const invByKey = new Map<string, InvInput[]>();
  for (const inv of inventories) {
    const key = inventoryMatchKey(inv.item_code);
    const bucket = invByKey.get(key);
    if (bucket) bucket.push(inv);
    else invByKey.set(key, [inv]);
  }

  // 입고 키 → 이 키를 토큰으로 가진 신고 id 목록 (모호성 탐지)
  const keyToDecls = new Map<string, string[]>();
  for (const decl of declarations) {
    if (!decl.model) continue;
    const keys = new Set(declarationKeys(decl.model).filter((k) => invByKey.has(k)));
    for (const k of keys) {
      const arr = keyToDecls.get(k);
      if (arr) arr.push(decl.id);
      else keyToDecls.set(k, [decl.id]);
    }
  }

  const assignments: GroupAssignment[] = [];
  const unmatchedDecls: DeclInput[] = [];
  const assignedInvIds = new Set<string>();

  for (const decl of declarations) {
    // 이 신고가 단독으로 점유하는(모호하지 않은) 키만 사용
    const ownKeys = decl.model
      ? [...new Set(declarationKeys(decl.model))].filter(
          (k) => invByKey.has(k) && keyToDecls.get(k)?.length === 1
        )
      : [];

    if (ownKeys.length === 0) {
      unmatchedDecls.push(decl);
      continue;
    }

    const invs = ownKeys.flatMap((k) => invByKey.get(k) ?? []);
    const invQtySum = invs.reduce((acc, i) => acc + i.qty, 0);
    invs.forEach((i) => assignedInvIds.add(i.id));
    assignments.push({
      declaration_item_id: decl.id,
      inventory_item_ids: invs.map((i) => i.id),
      inv_qty_sum: invQtySum,
      status: compareQty(decl.qty_35, invQtySum),
    });
  }

  const unassignedInv = inventories.filter((i) => !assignedInvIds.has(i.id));

  return { assignments, unmatchedDecls, unassignedInv };
}

/** 미배정 입고 품목을 키 단위 그룹으로 묶는다 (AI/수동 후보용) */
export interface InvGroup {
  inventory_key: string;
  item_name: string;
  qty_sum: number;
  row_count: number;
  inventory_item_ids: string[];
}

export function groupInventoryByKey(inventories: InvInput[]): InvGroup[] {
  const byKey = new Map<string, InvInput[]>();
  for (const inv of inventories) {
    const key = inventoryMatchKey(inv.item_code);
    const bucket = byKey.get(key);
    if (bucket) bucket.push(inv);
    else byKey.set(key, [inv]);
  }
  return [...byKey.entries()].map(([inventory_key, invs]) => ({
    inventory_key,
    item_name: invs[0].item_name,
    qty_sum: invs.reduce((acc, i) => acc + i.qty, 0),
    row_count: invs.length,
    inventory_item_ids: invs.map((i) => i.id),
  }));
}
