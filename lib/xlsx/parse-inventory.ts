import * as XLSX from "xlsx";
import { CURRENCY_CODE, REQUIRED_XLSX_COLUMNS } from "@/lib/types/constants";
import type { ParsedInventoryRow } from "@/lib/types/domain";

/**
 * 입고현황 xlsx 파싱 (F006)
 *
 * 이카운트 24컬럼 양식의 헤더 행 이후 데이터 행을 추출한다.
 * 컬럼은 위치가 아닌 헤더명으로 매핑한다(견고성).
 *
 * 영업팀 입력 규약(실측 확인):
 * - 통화 칸: 이카운트 통화코드(00001/00002) 직접 입력. "USD"/"CNY" 문자열도 허용.
 * - 외화금액 칸: 외화단가(unit_price_fx)를 입력. (단가 칸은 원화단가)
 * - 일자 칸: YYYYMMDD 정수 또는 날짜.
 */

/** 셀 → 숫자(콤마 제거), 실패 시 null */
function toNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

/** 통화 셀 → 이카운트 통화코드 (00001/00002) */
function toCurrencyCode(v: unknown): string | null {
  const s = String(v ?? "").trim();
  if (/^\d{5}$/.test(s)) return s; // 이미 통화코드
  const upper = s.toUpperCase();
  if (upper in CURRENCY_CODE) return CURRENCY_CODE[upper as keyof typeof CURRENCY_CODE];
  return null;
}

/** 일자 셀(YYYYMMDD 정수/문자/Date) → ISO date(YYYY-MM-DD) */
function toIsoDate(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const digits = String(v).replace(/\D/g, "");
  if (digits.length === 8) {
    return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
  }
  return null;
}

export interface ParseInventoryResult {
  rows: ParsedInventoryRow[];
  sheetName: string;
}

/**
 * xlsx 버퍼를 파싱한다. 필수 컬럼 누락 시 throw(호출부에서 400 처리).
 */
export function parseInventoryXlsx(data: Uint8Array): ParseInventoryResult {
  const wb = XLSX.read(data, { type: "array" });
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    blankrows: false,
    raw: true,
  });

  if (matrix.length === 0) {
    throw new Error("xlsx에 데이터가 없습니다.");
  }

  const header = (matrix[0] as unknown[]).map((c) => String(c ?? "").trim());
  const missing = REQUIRED_XLSX_COLUMNS.filter((col) => !header.includes(col));
  if (missing.length > 0) {
    throw new Error(`입고현황 xlsx에 필수 컬럼이 없습니다: ${missing.join(", ")}`);
  }

  const col = (name: string) => header.indexOf(name);
  const iCode = col("품목코드");
  const iName = col("품목명");
  const iQty = col("수량");
  const iFx = col("외화금액"); // 영업팀이 외화단가를 입력하는 칸
  const iDate = col("일자");
  const iCurrency = col("통화");

  const rows: ParsedInventoryRow[] = [];
  for (let r = 1; r < matrix.length; r++) {
    const row = matrix[r] as unknown[];
    const itemCode = String(row[iCode] ?? "").trim();
    const qty = toNumber(row[iQty]);
    // 품목코드·수량이 없는 행(빈 행/소계 등)은 스킵
    if (!itemCode || qty === null) continue;

    rows.push({
      row_no: r + 1, // 1-based 스프레드시트 행 번호(헤더=1행)
      item_code: itemCode,
      item_name: String(row[iName] ?? "").trim(),
      qty,
      unit_price_fx: toNumber(row[iFx]),
      currency_code: toCurrencyCode(row[iCurrency]) ?? "00001",
      in_date: toIsoDate(row[iDate]),
    });
  }

  return { rows, sheetName };
}
