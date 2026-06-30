import * as XLSX from "xlsx";
import { ECOUNT_COLUMNS } from "@/lib/types/constants";

/**
 * 이카운트 24컬럼 업로드 xlsx 생성 (F015, AC-05)
 *
 * ECOUNT_COLUMNS(SSOT)의 순서·헤더를 그대로 사용한다. 영업팀 입력 컬럼(isAuto=false)은
 * 입고현황 원본 값을 보존하고(미보유 컬럼은 공란), 자동 기입 컬럼(isAuto=true)만
 * 안분·환산 결과로 채운다. 적요=BL번호, 보관비=0 고정.
 *
 * ⚠️ 컬럼 추가·순서 변경 금지(이카운트 양식 고정). 변경 필요 시 PRD F015 수정 우선.
 */

/** 안분·환산 + 원본 입고를 결합한 이카운트 1행 입력 */
export interface EcountRowInput {
  /** 영업팀 입력(보존) */
  in_date: string | null;
  item_code: string;
  item_name: string;
  qty: number;
  /** 외화금액 칸 — 영업팀이 입력한 외화단가 원본 */
  unit_price_fx: number | null;
  /** 이카운트 통화코드(00001/00002) */
  currency_code: string;
  /** 자동 기입(안분·환산) */
  fx_rate: number | null;
  unit_price_krw: number | null;
  supply_amount: number | null;
  vat: number | null;
  bl_no: string | null;
  freight: number | null;
  fee: number | null;
  etc_amount: number | null;
}

/** ISO(YYYY-MM-DD) → 이카운트 일자(YYYYMMDD), null은 공란 */
function toEcountDate(iso: string | null): string {
  return iso ? iso.replace(/-/g, "") : "";
}

export type Cell = string | number;

/** 컬럼 key → 셀 값 매핑 (24컬럼 전부 명시). xlsx 출력·미리보기 공용. */
export function ecountCells(r: EcountRowInput): Record<string, Cell> {
  return {
    // 영업팀 입력(보존) — 미보유 컬럼은 공란
    date: toEcountDate(r.in_date),
    seq: "",
    client_code: "",
    client_name: "",
    manager: "",
    warehouse: "",
    trade_type: "",
    project: "",
    item_code: r.item_code,
    item_name: r.item_name,
    spec: "",
    qty: r.qty,
    fx_amount: r.unit_price_fx ?? "",
    extra_cost: "",
    // 자동 기입
    currency: r.currency_code,
    fx_rate: r.fx_rate ?? "",
    unit_price: r.unit_price_krw ?? "",
    supply_amount: r.supply_amount ?? "",
    vat: r.vat ?? "",
    remark: r.bl_no ?? "",
    freight: r.freight ?? 0,
    storage: 0,
    fee: r.fee ?? 0,
    etc: r.etc_amount ?? 0,
  };
}

/** 이카운트 24컬럼 xlsx를 생성해 Buffer로 반환한다. */
export function buildEcountXlsx(rows: EcountRowInput[]): Buffer {
  const header = ECOUNT_COLUMNS.map((c) => c.label);
  const aoa: Cell[][] = [header];
  for (const r of rows) {
    const cells = ecountCells(r);
    aoa.push(ECOUNT_COLUMNS.map((c) => cells[c.key] ?? ""));
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "이카운트업로드");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
