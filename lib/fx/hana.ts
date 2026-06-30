import type { Currency } from "@/lib/types/enums";
import type { FxAdapter } from "@/lib/fx/types";

/**
 * 하나은행 환율 어댑터 (F012, 1순위 외부 소스 — 최초 고시 매매기준율)
 *
 * 외부 엔드포인트·자격증명은 서버 전용 환경변수(FX_HANA_API_URL)로만 주입하며,
 * 클라이언트에 노출하지 않는다(NEXT_PUBLIC_ 금지). 엔드포인트 미설정·네트워크
 * 오류·응답 파싱 실패는 모두 null로 흡수해, resolveFxRate가 서울외환으로 폴백한다.
 *
 * 응답 계약: GET ${FX_HANA_API_URL}?date=YYYY-MM-DD&currency=USD → { "rate": number }
 * (실제 소스 스크래핑은 MVP 이후 교체 대상. 미설정 시 어댑터는 항상 null.)
 */

async function fetchHanaRate(date: string, currency: Currency): Promise<number | null> {
  const base = process.env.FX_HANA_API_URL;
  if (!base) return null;

  try {
    const url = `${base}?date=${encodeURIComponent(date)}&currency=${encodeURIComponent(currency)}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const body = (await res.json()) as { rate?: unknown };
    const rate = typeof body.rate === "number" ? body.rate : Number(body.rate);
    return Number.isFinite(rate) && rate > 0 ? rate : null;
  } catch {
    return null;
  }
}

export const hanaAdapter: FxAdapter = {
  source: "hana",
  fetchRate: fetchHanaRate,
};
