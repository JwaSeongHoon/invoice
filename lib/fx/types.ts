import type { Currency, FxSource } from "@/lib/types/enums";

/**
 * 환율 소스 어댑터 인터페이스 (F012, OI-1)
 *
 * 외부 환율 소스(하나은행·서울외국환중개소)를 동일 시그니처로 추상화한다.
 * 조회 실패·응답 파싱 실패는 예외를 던지지 않고 null을 반환해, 상위(resolveFxRate)가
 * 다음 소스로 폴백할 수 있게 한다(외부 소스 장애 견고성).
 */
export interface FxAdapter {
  /** 이 어댑터가 기록하는 출처 (fx_rate_cache.source) */
  source: Exclude<FxSource, "manual">;
  /**
   * 고시일(YYYY-MM-DD, 영업일) 기준 통화의 매매기준율을 조회한다.
   * 실패 시 null.
   */
  fetchRate(date: string, currency: Currency): Promise<number | null>;
}

/** 어댑터 폴백 조회 성공 결과 (출처 + 환율) */
export interface FxFetchHit {
  rate: number;
  source: Exclude<FxSource, "manual">;
}
