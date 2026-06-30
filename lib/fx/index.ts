import type { Currency } from "@/lib/types/enums";
import type { FxFetchHit } from "@/lib/fx/types";
import { hanaAdapter } from "@/lib/fx/hana";
import { smbsAdapter } from "@/lib/fx/smbs";

/**
 * 환율 어댑터 폴백 체인 (F012)
 *
 * 조회 순서 고정: 하나은행(hana) → 서울외국환중개소(smbs). 캐시 조회와
 * 결과 저장(fx_rate_cache)·수동 오버라이드는 Route Handler(app/api/fx)가
 * 담당하고, 이 모듈은 외부 소스 폴백 로직만 순수 함수로 제공한다.
 */

export { prevBusinessDay, isIsoDate } from "@/lib/fx/business-day";
export type { FxAdapter, FxFetchHit } from "@/lib/fx/types";

/** 폴백 순서대로 정렬된 외부 환율 어댑터 */
const FX_ADAPTERS = [hanaAdapter, smbsAdapter] as const;

/**
 * 영업일·통화 기준으로 어댑터를 순서대로 시도해 첫 성공 결과를 반환한다.
 * 모든 소스 실패 시 null(→ 호출부에서 수동 오버라이드 안내).
 */
export async function fetchRateFromAdapters(
  date: string,
  currency: Currency
): Promise<FxFetchHit | null> {
  for (const adapter of FX_ADAPTERS) {
    const rate = await adapter.fetchRate(date, currency);
    if (rate !== null) {
      return { rate, source: adapter.source };
    }
  }
  return null;
}
