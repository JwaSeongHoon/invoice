/**
 * ㉟=㊶ 수량 검증 로직 (F005, AC-01, 검증로직.md)
 *
 * 검증식: Σ(모든 페이지 qty_35) == Σ(모든 페이지 qty_41_total)
 * qty_41_total은 페이지 단위 값이므로 페이지별로 1회만 합산한다
 * (declaration_item에는 라인별로 중복 저장되어 있음).
 */

/** 불일치 시 규정 오류 메시지 (정확한 문구 — 변경 금지) */
export const QTY_MISMATCH_MESSAGE =
  "수입신고필증의 35번 수량 합계와 41번 수량 합계가 일치하지 않습니다.";

export interface QtyValidationInput {
  page_index: number;
  qty_35: number | null;
  qty_41_total: number | null;
}

export interface QtyValidationResult {
  passed: boolean;
  /** Σ qty_35 (기댓값) */
  expected: number;
  /** Σ qty_41_total (페이지별, 실제값) */
  actual: number;
}

export function validateQty(rows: QtyValidationInput[]): QtyValidationResult {
  const sumQty35 = rows.reduce((acc, r) => acc + (r.qty_35 ?? 0), 0);

  // 페이지별 qty_41_total (라인 중복 제거)
  const perPage = new Map<number, number>();
  for (const r of rows) {
    if (!perPage.has(r.page_index)) {
      perPage.set(r.page_index, r.qty_41_total ?? 0);
    }
  }
  const sumQty41 = [...perPage.values()].reduce((acc, v) => acc + v, 0);

  return {
    passed: sumQty35 === sumQty41,
    expected: sumQty35,
    actual: sumQty41,
  };
}
