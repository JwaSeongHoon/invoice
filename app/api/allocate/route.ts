import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";
import {
  adjustUnitPrice,
  computeAllocations,
  verifyUnitPrice,
  type AllocInput,
} from "@/lib/allocate";
import { prevBusinessDay } from "@/lib/fx";
import { CODE_TO_CURRENCY } from "@/lib/types/constants";
import type { Currency, ValidationType } from "@/lib/types/enums";
import type {
  AllocateResponse,
  AllocationRow,
  FxSourceSummary,
  ValidationSummary,
} from "@/lib/types/domain";

export const runtime = "nodejs";

interface DeclRow {
  id: string;
  qty_35: number | null;
  unit_price_usd: number | null;
  amount_usd: number | null;
  bl_no: string | null;
}
interface InvRow {
  id: string;
  qty: number;
  currency_code: string;
  in_date: string | null;
  item_name: string;
}
interface MatchRow {
  declaration_item_id: string | null;
  inventory_item_id: string | null;
  status: string;
}

/** 통화코드 → Currency (미상은 USD 기본) */
function toCurrency(code: string): Currency {
  return CODE_TO_CURRENCY[code] ?? "USD";
}

// POST /api/allocate — 외화단가 역산·부대비용 안분·원화 환산·검증 (F011, F013, F014, AC-03)
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: claims, error: authError } = await supabase.auth.getClaims();
  if (authError || !claims?.claims) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { batchId?: string } | null;
  const batchId = body?.batchId;
  if (!batchId) {
    return NextResponse.json({ error: "batchId가 필요합니다." }, { status: 400 });
  }

  // 매칭·신고·입고·정산서 로드 (RLS로 본인 배치만)
  const [declRes, invRes, matchRes, settleRes] = await Promise.all([
    supabase
      .from("declaration_item")
      .select("id, qty_35, unit_price_usd, amount_usd, bl_no")
      .eq("batch_id", batchId),
    supabase
      .from("inventory_item")
      .select("id, qty, currency_code, in_date, item_name")
      .eq("batch_id", batchId),
    supabase
      .from("item_match")
      .select("declaration_item_id, inventory_item_id, status")
      .eq("batch_id", batchId)
      .neq("status", "review"),
    supabase
      .from("settlement")
      .select("customs_fee, freight_subtotal, customs_vat, duty_amount, bl_no")
      .eq("batch_id", batchId)
      .maybeSingle(),
  ]);

  if (declRes.error || invRes.error || matchRes.error || settleRes.error) {
    return NextResponse.json({ error: "안분 대상 데이터를 불러오지 못했습니다." }, { status: 500 });
  }
  const declRows = (declRes.data ?? []) as DeclRow[];
  const invRows = (invRes.data ?? []) as InvRow[];
  const matchRows = (matchRes.data ?? []) as MatchRow[];
  const settlement = settleRes.data;

  if (declRows.length === 0 || invRows.length === 0) {
    return NextResponse.json(
      { error: "신고필증/입고현황 데이터가 없습니다. 먼저 처리를 완료하세요." },
      { status: 422 }
    );
  }
  if (!settlement) {
    return NextResponse.json({ error: "정산서 파싱 데이터가 없습니다." }, { status: 422 });
  }

  const declById = new Map<string, DeclRow>(declRows.map((d) => [d.id, d]));
  const invById = new Map<string, InvRow>(invRows.map((i) => [i.id, i]));

  // 확정 매칭: 입고 → {신고, 상태}, 신고 → 입고수량 합(역산용 그룹 수량)
  const matchByInv = new Map<string, { declId: string; status: string }>();
  const groupQtyByDecl = new Map<string, number>();
  for (const m of matchRows) {
    if (!m.declaration_item_id || !m.inventory_item_id) continue;
    const inv = invById.get(m.inventory_item_id);
    if (!inv) continue;
    matchByInv.set(m.inventory_item_id, { declId: m.declaration_item_id, status: m.status });
    groupQtyByDecl.set(
      m.declaration_item_id,
      (groupQtyByDecl.get(m.declaration_item_id) ?? 0) + inv.qty
    );
  }
  if (matchByInv.size === 0) {
    return NextResponse.json(
      { error: "확정된 매칭이 없습니다. 먼저 매칭을 완료하세요." },
      { status: 422 }
    );
  }

  // 입고일 기준 환율 조회 (직전 영업일 보정 후 fx_rate_cache 조회)
  const fxKeys = new Map<string, { quoteDate: string; currency: Currency }>();
  for (const inv of invRows) {
    if (!matchByInv.has(inv.id)) continue;
    if (!inv.in_date) {
      return NextResponse.json(
        { error: "입고일이 없는 품목이 있어 환율을 적용할 수 없습니다." },
        { status: 422 }
      );
    }
    const currency = toCurrency(inv.currency_code);
    const quoteDate = prevBusinessDay(inv.in_date);
    fxKeys.set(`${quoteDate}|${currency}`, { quoteDate, currency });
  }

  const fxByKey = new Map<string, FxSourceSummary>();
  const missingFx: string[] = [];
  await Promise.all(
    [...fxKeys.entries()].map(async ([key, { quoteDate, currency }]) => {
      const { data } = await supabase
        .from("fx_rate_cache")
        .select("quote_date, currency, rate, source")
        .eq("quote_date", quoteDate)
        .eq("currency", currency)
        .maybeSingle();
      if (data) {
        fxByKey.set(key, {
          currency,
          quote_date: data.quote_date,
          rate: data.rate,
          source: data.source as FxSourceSummary["source"],
        });
      } else {
        missingFx.push(`${currency} ${quoteDate}`);
      }
    })
  );
  if (missingFx.length > 0) {
    return NextResponse.json(
      {
        error: `환율 정보가 없습니다. 먼저 환율을 조회/입력하세요: ${missingFx.join(", ")}`,
        needsManual: true,
      },
      { status: 422 }
    );
  }

  // 품목별 안분 입력 조립 (역산 보정 외화단가 + 환율 + 안분 기준)
  const blNo = settlement.bl_no ?? null;
  const inputs: AllocInput[] = [];
  for (const inv of invRows) {
    const match = matchByInv.get(inv.id);
    if (!match) continue;
    const decl = declById.get(match.declId);
    const groupQty = groupQtyByDecl.get(match.declId) ?? inv.qty;
    const adjustedUnit = adjustUnitPrice(
      decl?.amount_usd ?? null,
      decl?.unit_price_usd ?? null,
      groupQty
    );
    const currency = toCurrency(inv.currency_code);
    const quoteDate = prevBusinessDay(inv.in_date!);
    const fx = fxByKey.get(`${quoteDate}|${currency}`)!;
    inputs.push({
      inventory_item_id: inv.id,
      qty: inv.qty,
      fx_rate: fx.rate,
      adjustedUnit,
      alloc_basis: match.status === "match" ? "decl" : "inventory",
      bl_no: blNo ?? decl?.bl_no ?? null,
    });
  }

  // 정산서 칸 매핑(고정): 운반비=통관수수료+SUB TOTAL, 수수료=통관부가세, 기타=관세
  const totals = {
    freight: (settlement.customs_fee ?? 0) + (settlement.freight_subtotal ?? 0),
    fee: settlement.customs_vat ?? 0,
    etc: settlement.duty_amount ?? 0,
  };

  const computed = computeAllocations(inputs, totals);

  // allocation_result 멱등 저장 (기존 삭제 후 삽입)
  await supabase.from("allocation_result").delete().eq("batch_id", batchId);
  const { error: insertError } = await supabase.from("allocation_result").insert(
    computed.map((c) => ({
      batch_id: batchId,
      inventory_item_id: c.inventory_item_id,
      bl_no: c.bl_no,
      unit_price_fx_adjusted: c.unit_price_fx_adjusted,
      unit_price_krw: c.unit_price_krw,
      supply_amount: c.supply_amount,
      vat: c.vat,
      fx_rate: c.fx_rate,
      freight: c.freight,
      fee: c.fee,
      etc_amount: c.etc_amount,
      alloc_basis: c.alloc_basis,
    }))
  );
  if (insertError) {
    return NextResponse.json({ error: "안분 결과 저장에 실패했습니다." }, { status: 500 });
  }

  // 검증 3종 산출
  const declTotalAmount = [...groupQtyByDecl.keys()].reduce((acc, declId) => {
    const decl = declById.get(declId);
    if (!decl) return acc;
    const amount =
      decl.amount_usd ??
      (decl.unit_price_usd !== null && decl.qty_35 !== null
        ? decl.unit_price_usd * decl.qty_35
        : 0);
    return acc + amount;
  }, 0);
  const unitCheck = verifyUnitPrice(
    inputs.map((i) => ({ qty: i.qty, adjustedUnit: i.adjustedUnit })),
    declTotalAmount
  );
  const sumFreight = computed.reduce((acc, c) => acc + c.freight, 0);
  const sumFee = computed.reduce((acc, c) => acc + c.fee, 0);
  const sumEtc = computed.reduce((acc, c) => acc + c.etc_amount, 0);

  const validations: ValidationSummary[] = [
    {
      type: "unitprice",
      passed: unitCheck.passed,
      expected: unitCheck.expected,
      actual: unitCheck.actual,
    },
    {
      type: "alloc_freight",
      passed: sumFreight === totals.freight,
      expected: totals.freight,
      actual: sumFreight,
    },
    { type: "alloc_fee", passed: sumFee === totals.fee, expected: totals.fee, actual: sumFee },
    { type: "alloc_etc", passed: sumEtc === totals.etc, expected: totals.etc, actual: sumEtc },
  ];

  // validation_log 멱등 기록 (type별 delete 후 insert)
  const validationMessages: Record<ValidationType, string> = {
    qty3541: "",
    unitprice: "외화단가 역산 보정 합계가 신고필증 품목 총액과 일치하지 않습니다.",
    alloc_freight: "운반비 안분 합계가 정산서 운반비 총액과 일치하지 않습니다.",
    alloc_fee: "수수료 안분 합계가 정산서 수수료 총액과 일치하지 않습니다.",
    alloc_etc: "기타 안분 합계가 정산서 기타 총액과 일치하지 않습니다.",
  };
  for (const v of validations) {
    await supabase.from("validation_log").delete().eq("batch_id", batchId).eq("type", v.type);
    await supabase.from("validation_log").insert({
      batch_id: batchId,
      type: v.type,
      passed: v.passed,
      expected: v.expected,
      actual: v.actual,
      message: v.passed ? null : validationMessages[v.type],
    });
  }

  // 응답 행 조립 (UI 렌더용)
  const computedById = new Map(computed.map((c) => [c.inventory_item_id, c]));
  const rows: AllocationRow[] = inputs.map((i) => {
    const c = computedById.get(i.inventory_item_id)!;
    const inv = invById.get(i.inventory_item_id)!;
    return {
      inventory_item_id: i.inventory_item_id,
      item_name: inv.item_name,
      qty: inv.qty,
      currency: toCurrency(inv.currency_code),
      fx_rate: c.fx_rate,
      unit_price_fx_adjusted: c.unit_price_fx_adjusted,
      unit_price_krw: c.unit_price_krw,
      supply_amount: c.supply_amount,
      vat: c.vat,
      freight: c.freight,
      fee: c.fee,
      etc_amount: c.etc_amount,
      alloc_basis: c.alloc_basis,
    };
  });

  const response: AllocateResponse = {
    rows,
    validations,
    fxSources: [...fxByKey.values()],
  };
  return NextResponse.json(response, { status: 200 });
}
