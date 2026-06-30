import type { MatchStatus } from "@/lib/types/enums";

/**
 * 수량 비교 (F010)
 *
 * 신고수량(㉟)과 입고수량을 비교하여 매칭 상태를 산출한다.
 * 일치 → "match", 불일치 → "mismatch".
 * (불일치도 매칭 자체는 확정 상태이며, 안분 단계에서 입고수량 기준으로 처리된다.)
 */
export function compareQty(
  qty35: number | null,
  invQty: number
): Extract<MatchStatus, "match" | "mismatch"> {
  return (qty35 ?? 0) === invQty ? "match" : "mismatch";
}
