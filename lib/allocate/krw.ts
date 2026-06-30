/**
 * 원화 환산 (F014) — DB 비의존 순수 로직
 *
 * 환산식(shrimp-rules 6.2, 임의 변형 금지):
 *   단가(원화)   = round(보정 외화단가 × 환율)
 *   공급가액     = round(수량 × 단가 / 1.1)
 *   부가세       = round(공급가액 × 10%)
 * 모든 금액은 원 단위로 반올림한다(부동소수 == 직접 비교 금지).
 */

export interface KrwConversion {
  unit_price_krw: number;
  supply_amount: number;
  vat: number;
}

export function convertKrw(adjustedUnit: number, qty: number, fxRate: number): KrwConversion {
  const unit_price_krw = Math.round(adjustedUnit * fxRate);
  const supply_amount = Math.round((qty * unit_price_krw) / 1.1);
  const vat = Math.round(supply_amount * 0.1);
  return { unit_price_krw, supply_amount, vat };
}
