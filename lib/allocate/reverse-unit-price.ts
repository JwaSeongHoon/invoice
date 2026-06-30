/**
 * 외화단가 역산 보정 (F011) — DB 비의존 순수 로직
 *
 * 영업팀이 입력한 외화단가(외화금액 칸)는 반올림되어 신고필증 품목 총액과 어긋날 수 있다.
 * 신고필증의 품목 총액(㊲ amount_usd)을 권위값으로 삼아, 모델 그룹의 수량 합으로
 * 나눠 보정 외화단가를 역산한다. 모델 그룹 내 입고 SKU(색상·사이즈)는 동일 단가를 공유한다.
 *
 * 검증식(F011): Σ(행 수량 × 보정 단가) == 신고필증 품목 총액.
 */

/** USD 비교용 소수 2자리 반올림 */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * 모델 그룹의 보정 외화단가를 역산한다.
 * 우선순위: 신고필증 품목총액(amount_usd) / 그룹수량 → 신고 단가(unit_price_usd) → 0.
 */
export function adjustUnitPrice(
  declAmount: number | null,
  declUnit: number | null,
  groupQty: number
): number {
  if (groupQty > 0 && declAmount !== null && declAmount > 0) {
    return declAmount / groupQty;
  }
  if (declUnit !== null && declUnit > 0) return declUnit;
  return 0;
}

export interface UnitPriceCheck {
  passed: boolean;
  /** 신고필증 품목 총액 합계(USD) */
  expected: number;
  /** Σ(수량 × 보정단가)(USD) */
  actual: number;
}

/**
 * 전체 배치의 역산 보정 합계 검증(type=unitprice).
 * USD 금액이므로 소수 2자리 반올림 후 비교한다(부동소수 == 직접 비교 금지).
 */
export function verifyUnitPrice(
  rows: { qty: number; adjustedUnit: number }[],
  declTotalAmount: number
): UnitPriceCheck {
  const actual = round2(rows.reduce((acc, r) => acc + r.qty * r.adjustedUnit, 0));
  const expected = round2(declTotalAmount);
  return { passed: actual === expected, expected, actual };
}
