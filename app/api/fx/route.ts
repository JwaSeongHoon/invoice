import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";
import { fetchRateFromAdapters, prevBusinessDay, isIsoDate } from "@/lib/fx";
import type { Currency, FxSource } from "@/lib/types/enums";
import type { FxRateResult } from "@/lib/types/domain";

export const runtime = "nodejs";

interface FxRequestBody {
  date?: string;
  currency?: string;
  manualRate?: number;
}

/** 수동 오버라이드 안내(양 소스 실패) 응답 */
interface NeedsManualResult {
  needsManual: true;
  quote_date: string;
  currency: Currency;
}

const SUPPORTED_CURRENCIES: Currency[] = ["USD", "CNY"];

function isCurrency(value: string): value is Currency {
  return (SUPPORTED_CURRENCIES as string[]).includes(value);
}

// POST /api/fx — 환율 조회 (캐시→하나은행→서울외환→수동 오버라이드) (F012, AC-04)
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: claims, error: authError } = await supabase.auth.getClaims();
  if (authError || !claims?.claims) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as FxRequestBody | null;
  const date = body?.date;
  const currency = body?.currency;
  const manualRate = body?.manualRate;

  if (!date || !isIsoDate(date)) {
    return NextResponse.json(
      { error: "조회 기준일(date, YYYY-MM-DD)이 필요합니다." },
      { status: 400 }
    );
  }
  if (!currency || !isCurrency(currency)) {
    return NextResponse.json(
      { error: "통화(currency)는 USD 또는 CNY여야 합니다." },
      { status: 400 }
    );
  }
  if (manualRate !== undefined && (!Number.isFinite(manualRate) || manualRate <= 0)) {
    return NextResponse.json({ error: "수동 환율은 0보다 큰 숫자여야 합니다." }, { status: 400 });
  }

  // 좁혀진 통화 — 중첩 함수 클로저에서 narrowing 유지를 위해 지역 상수로 고정
  const cur: Currency = currency;

  // 비영업일(주말) 입고 → 직전 영업일 고시 적용
  const quoteDate = prevBusinessDay(date);

  // 결과를 fx_rate_cache에 멱등 저장(같은 날짜·통화 기존 행 제거 후 삽입)
  async function cacheRate(rate: number, source: FxSource): Promise<FxRateResult> {
    await supabase.from("fx_rate_cache").delete().eq("quote_date", quoteDate).eq("currency", cur);
    await supabase
      .from("fx_rate_cache")
      .insert({ quote_date: quoteDate, currency: cur, rate, source });
    return { quote_date: quoteDate, currency: cur, rate, source };
  }

  // 1) 수동 오버라이드: 외부 조회 없이 즉시 저장
  if (manualRate !== undefined) {
    const result = await cacheRate(manualRate, "manual");
    return NextResponse.json(result, { status: 200 });
  }

  // 2) 캐시 히트: 외부 호출 없이 즉시 반환
  const { data: cached } = await supabase
    .from("fx_rate_cache")
    .select("quote_date, currency, rate, source")
    .eq("quote_date", quoteDate)
    .eq("currency", cur)
    .maybeSingle();
  if (cached) {
    const result: FxRateResult = {
      quote_date: cached.quote_date,
      currency: cur,
      rate: cached.rate,
      source: cached.source as FxSource,
    };
    return NextResponse.json(result, { status: 200 });
  }

  // 3) 외부 소스 폴백: 하나은행 → 서울외환
  const hit = await fetchRateFromAdapters(quoteDate, cur);
  if (hit) {
    const result = await cacheRate(hit.rate, hit.source);
    return NextResponse.json(result, { status: 200 });
  }

  // 4) 양 소스 실패 → 수동 오버라이드 안내
  const needsManual: NeedsManualResult = {
    needsManual: true,
    quote_date: quoteDate,
    currency: cur,
  };
  return NextResponse.json(needsManual, { status: 200 });
}
