import type { Currency } from "@/lib/types/enums";
import type { FxAdapter } from "@/lib/fx/types";

/**
 * 서울외국환중개소(smbs) 환율 어댑터 (F012, 2순위 폴백 소스)
 *
 * 하나은행 조회 실패 시 폴백한다. 외부 엔드포인트는 서버 전용 환경변수
 * (FX_SMBS_API_URL)로만 주입하며 클라이언트 노출 금지. 미설정·오류·파싱 실패는
 * null로 흡수해, resolveFxRate가 수동 오버라이드 단계로 넘어가게 한다.
 *
 * 응답 계약: GET ${FX_SMBS_API_URL}?date=YYYY-MM-DD&currency=USD → { "rate": number }
 */

async function fetchSmbsRate(date: string, currency: Currency): Promise<number | null> {
  const base = process.env.FX_SMBS_API_URL;
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

export const smbsAdapter: FxAdapter = {
  source: "smbs",
  fetchRate: fetchSmbsRate,
};
