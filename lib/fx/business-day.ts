/**
 * 영업일 보정 (F012, OI-6)
 *
 * 환율은 영업일에만 고시되므로, 비영업일(주말) 입고일은 직전 영업일로 당긴다.
 * 공휴일은 MVP 범위에서 제외하며(수동 오버라이드로 대응), 토·일요일만 처리한다.
 * 입력·출력 모두 ISO 날짜 문자열(YYYY-MM-DD)이며, 타임존 영향을 피하기 위해
 * UTC 기준으로 계산한다.
 */

/** YYYY-MM-DD 형식 여부 */
export function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/** 주말이면 직전 금요일로 당긴 ISO 날짜를 반환한다(평일은 그대로). */
export function prevBusinessDay(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  const day = d.getUTCDay(); // 0=일, 6=토
  if (day === 6) d.setUTCDate(d.getUTCDate() - 1);
  else if (day === 0) d.setUTCDate(d.getUTCDate() - 2);
  return d.toISOString().slice(0, 10);
}
