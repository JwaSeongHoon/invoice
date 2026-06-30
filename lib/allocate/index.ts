import type { AllocBasis } from "@/lib/types/enums";
import { allocateByQty, type AllocWeightItem } from "@/lib/allocate/allocate-cost";
import { convertKrw } from "@/lib/allocate/krw";

/**
 * 안분·환산 조립 (F013, F014) — DB 비의존 순수 로직
 *
 * 칸별 안분(allocate-cost) + 원화 환산(krw)을 품목 단위로 결합해
 * allocation_result 한 행에 해당하는 계산 결과를 만든다.
 */

export {
  adjustUnitPrice,
  verifyUnitPrice,
  type UnitPriceCheck,
} from "@/lib/allocate/reverse-unit-price";
export { allocateByQty, verifyAllocSum, type AllocSumCheck } from "@/lib/allocate/allocate-cost";
export { convertKrw, type KrwConversion } from "@/lib/allocate/krw";

/** 안분·환산 입력 (품목 단위) */
export interface AllocInput {
  inventory_item_id: string;
  qty: number;
  /** 입고일 기준 적용 환율 */
  fx_rate: number;
  /** 역산 보정된 외화단가(USD) */
  adjustedUnit: number;
  /** 안분 기준 (수량 일치 decl / 불일치 inventory) */
  alloc_basis: AllocBasis;
  bl_no: string | null;
}

/** 정산서 칸 총액 (원 단위) */
export interface CostTotals {
  freight: number;
  fee: number;
  etc: number;
}

/** allocation_result 한 행에 대응하는 계산 결과 */
export interface ComputedAllocation {
  inventory_item_id: string;
  bl_no: string | null;
  unit_price_fx_adjusted: number;
  unit_price_krw: number;
  supply_amount: number;
  vat: number;
  fx_rate: number;
  freight: number;
  fee: number;
  etc_amount: number;
  alloc_basis: AllocBasis;
}

/**
 * 전체 품목에 대해 칸별 안분 + 원화 환산을 수행한다.
 * 부대비용은 전 품목 수량 비중으로 한 번에 안분하므로 Σ == 칸 총액이 보장된다.
 */
export function computeAllocations(items: AllocInput[], totals: CostTotals): ComputedAllocation[] {
  const weights: AllocWeightItem[] = items.map((i) => ({
    inventory_item_id: i.inventory_item_id,
    qty: i.qty,
  }));

  const freightMap = allocateByQty(totals.freight, weights);
  const feeMap = allocateByQty(totals.fee, weights);
  const etcMap = allocateByQty(totals.etc, weights);

  return items.map((item) => {
    const krw = convertKrw(item.adjustedUnit, item.qty, item.fx_rate);
    return {
      inventory_item_id: item.inventory_item_id,
      bl_no: item.bl_no,
      unit_price_fx_adjusted: item.adjustedUnit,
      unit_price_krw: krw.unit_price_krw,
      supply_amount: krw.supply_amount,
      vat: krw.vat,
      fx_rate: item.fx_rate,
      freight: freightMap.get(item.inventory_item_id) ?? 0,
      fee: feeMap.get(item.inventory_item_id) ?? 0,
      etc_amount: etcMap.get(item.inventory_item_id) ?? 0,
      alloc_basis: item.alloc_basis,
    };
  });
}
