import type {
  AllocBasis,
  BatchStatus,
  FxSource,
  MatchMethod,
  MatchStatus,
  ValidationType,
} from "@/lib/types/enums";

/**
 * 업무 8개 테이블 Row 도메인 인터페이스 (단일 진실 공급원: docs/PRD.md 8장)
 *
 * ⚠️ lib/supabase/database.types.ts(자동 생성)와 역할 분리:
 *   - database.types.ts: Supabase 스키마 원천(db:types 재생성 대상)
 *   - 본 파일: 애플리케이션 도메인 타입 — 재생성 시 소실 방지 위해 수기 유지
 * 컬럼명·타입은 PRD 8장과 1:1 일치해야 한다.
 */

/** import_batch — 정산 처리 배치 */
export interface ImportBatch {
  id: string;
  user_id: string;
  status: BatchStatus;
  pdf_path: string | null;
  xlsx_path: string | null;
  created_at: string;
}

/** settlement — 수입정산서 파싱 결과 */
export interface Settlement {
  id: string;
  batch_id: string;
  bl_no: string | null;
  duty_rate: number | null;
  freight_subtotal: number | null;
  customs_fee: number | null;
  customs_vat: number | null;
  duty_amount: number | null;
  raw_json: unknown | null;
}

/** declaration_item — 신고필증 OCR 라인 아이템 */
export interface DeclarationItem {
  id: string;
  batch_id: string;
  page_index: number;
  declaration_no: string | null;
  bl_no: string | null;
  model: string | null;
  qty_35: number | null;
  unit_price_usd: number | null;
  amount_usd: number | null;
  qty_41_total: number | null;
  fx_rate_65: number | null;
  confidence: number | null;
}

/** inventory_item — 입고현황 xlsx 행 */
export interface InventoryItem {
  id: string;
  batch_id: string;
  row_no: number;
  item_code: string;
  item_name: string;
  qty: number;
  unit_price_fx: number | null;
  currency_code: string;
  in_date: string | null;
}

/** item_match — 매칭 결과 */
export interface ItemMatch {
  id: string;
  batch_id: string;
  declaration_item_id: string | null;
  inventory_item_id: string | null;
  method: MatchMethod;
  score: number | null;
  status: MatchStatus;
  confirmed_by: string | null;
}

/** allocation_result — 안분·환산 결과 (= 이카운트 행) */
export interface AllocationResult {
  id: string;
  batch_id: string;
  inventory_item_id: string;
  bl_no: string | null;
  unit_price_fx_adjusted: number | null;
  unit_price_krw: number | null;
  supply_amount: number | null;
  vat: number | null;
  fx_rate: number | null;
  freight: number | null;
  fee: number | null;
  etc_amount: number | null;
  alloc_basis: AllocBasis;
}

/** fx_rate_cache — 환율 캐시 (공용 읽기) */
export interface FxRateCache {
  id: string;
  quote_date: string;
  currency: string;
  rate: number;
  source: FxSource;
  fetched_at: string;
}

/** validation_log — 검증 결과 로그 */
export interface ValidationLog {
  id: string;
  batch_id: string;
  type: ValidationType;
  passed: boolean;
  expected: number | null;
  actual: number | null;
  message: string | null;
  created_at: string;
}
