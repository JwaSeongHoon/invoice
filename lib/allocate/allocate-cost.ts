/**
 * 부대비용 안분 (F013) — DB 비의존 순수 로직
 *
 * 정산서 칸별 총액(운반비·수수료·기타)을 품목별 수량 비중으로 안분한다.
 * 원 단위 반올림 후 잔차(총액 − Σ반올림)는 최대 수량 품목에 가산해 합계 일치를 보장한다.
 *
 * 검증식(F013, AC-03): Σ(품목 안분액) == 정산서 해당 칸 총액.
 */

/** 안분 대상 품목 (식별자 + 수량 비중) */
export interface AllocWeightItem {
  inventory_item_id: string;
  qty: number;
}

/**
 * 단일 칸 총액을 수량 비중으로 안분한다(원 단위 반올림 + 잔차 최대수량 가산).
 * 총액 0 또는 수량 합 0이면 전 품목 0을 반환한다.
 * @returns inventory_item_id → 안분액(원) 매핑
 */
export function allocateByQty(total: number, items: AllocWeightItem[]): Map<string, number> {
  const result = new Map<string, number>();
  if (items.length === 0) return result;

  const totalQty = items.reduce((acc, i) => acc + i.qty, 0);
  if (total === 0 || totalQty <= 0) {
    for (const item of items) result.set(item.inventory_item_id, 0);
    return result;
  }

  let allocated = 0;
  for (const item of items) {
    const amount = Math.round((total * item.qty) / totalQty);
    result.set(item.inventory_item_id, amount);
    allocated += amount;
  }

  // 잔차(반올림 오차)를 최대 수량 품목에 가산해 Σ == total 보장
  const residual = total - allocated;
  if (residual !== 0) {
    const maxItem = items.reduce((a, b) => (b.qty > a.qty ? b : a));
    result.set(maxItem.inventory_item_id, (result.get(maxItem.inventory_item_id) ?? 0) + residual);
  }

  return result;
}

export interface AllocSumCheck {
  passed: boolean;
  expected: number;
  actual: number;
}

/** 안분 합계 검증: Σ(안분액) == 칸 총액 (원 단위 정수 비교) */
export function verifyAllocSum(allocated: Map<string, number>, total: number): AllocSumCheck {
  const actual = [...allocated.values()].reduce((acc, v) => acc + v, 0);
  return { passed: actual === total, expected: total, actual };
}
