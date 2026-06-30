import type { AllocBasis, Currency, MatchMethod, MatchStatus } from "@/lib/types/enums";

/**
 * 처리 파이프라인 도메인 타입 (업로드 → 분류 → OCR → 매칭 → 안분)
 *
 * DB Row(database.ts)와 별개로, Route Handler 간 주고받는 중간 처리 결과·
 * 외부 AI 응답 스키마를 표현한다.
 */

/** PDF 페이지 분류 종류 (F002: 정산서/세금계산서/신고필증/스킵) */
export type PdfPageKind = "settlement" | "tax_invoice" | "declaration" | "skip";

/** PDF 페이지별 분류 결과 */
export interface PdfPageClassification {
  page_index: number;
  kind: PdfPageKind;
}

/** PDF 전체 분류 결과 (F002) */
export interface PdfClassifyResult {
  total_pages: number;
  pages: PdfPageClassification[];
  /** ACE 경계 문구 검출 여부 — 미검출 시 사용자 확인 단계 노출 */
  ace_detected: boolean;
}

/** 신고필증 OCR 단일 라인 아이템 (Claude Vision 구조화 출력) */
export interface OcrLineItem {
  seq: number;
  model: string;
  /** ㉟ 수량 */
  qty_35: number;
  /** ㊱ 단가 USD */
  unit_price_usd_36: number;
  /** ㊲ 금액 USD */
  amount_usd_37: number;
}

/** 신고필증 페이지 OCR 추출 스키마 (F004) */
export interface OcrExtractSchema {
  declaration_no: string;
  bl_no: string;
  line_items: OcrLineItem[];
  /** ㊶ 환급물량 수량 합계(문서 합계) */
  qty_41_total: number;
  /** 65 환율 */
  fx_rate_65: number;
  duty_rate: number;
  /** OCR 신뢰도 (0~1). 0.85 미만 시 저신뢰 플래그 */
  confidence: number;
}

/** 수입정산서 1페이지 파싱 결과 (F003) */
export interface ParsedSettlement {
  /** B/L 번호 */
  bl_no: string | null;
  /** 관세율 (%) */
  duty_rate: number | null;
  /** 업무운임 SUB TOTAL (공급가액) */
  freight_subtotal: number | null;
  /** 통관수수료 */
  customs_fee: number | null;
  /** 통관부가세 (수수료 칸) */
  customs_vat: number | null;
  /** 관세 (기타 칸) */
  duty_amount: number | null;
  /** 핵심 필드를 모두 추출했는지 (실패 시 사용자 확인 필요 — CID 폰트 깨짐 등) */
  parsed_ok: boolean;
}

/** 입고현황 xlsx 단일 행 파싱 결과 (F006) */
export interface ParsedInventoryRow {
  /** 원본 xlsx 행 번호(1-based, 헤더=1행) */
  row_no: number;
  item_code: string;
  item_name: string;
  qty: number;
  /** 외화단가 — 영업팀이 '외화금액' 칸에 입력 */
  unit_price_fx: number | null;
  /** 이카운트 통화코드 (USD=00001 / CNY=00002) */
  currency_code: string;
  /** 입고일자 ISO (YYYY-MM-DD) */
  in_date: string | null;
}

/** /api/ingest 응답 (F001~F003, F006) */
export interface IngestResult {
  batchId: string;
  classification: PdfClassifyResult;
  settlement: ParsedSettlement;
  /** xlsx 파싱 행 수 (F006, Task 006에서 채움) */
  inventoryCount?: number;
  /** 분류 이상·정산서 파싱 실패 시 사용자 확인 필요 */
  needs_confirmation: boolean;
}

/**
 * 매칭 후보 입고 그룹 (F008) — 모델 그룹 단위 확정용
 *
 * 신고 1건이 입고 N건(색상·사이즈)과 대응하므로, 후보는 입고 키 단위 그룹이다.
 * 수동 확정 시 inventory_key로 그룹 전체를 한 번에 신고에 배정한다.
 */
export interface MatchGroupCandidate {
  inventory_key: string;
  /** 대표 한글 품목명 */
  item_name: string;
  /** 그룹 입고수량 합계 */
  qty_sum: number;
  /** 그룹 입고 행 수 */
  row_count: number;
  /** AI 유사도 점수 (재진입 fallback은 0) */
  score: number;
  /** 매칭 근거(한글) */
  reason: string;
}

/**
 * 매칭 검토 행 (POST /api/match 응답, F007~F010) — 신고 모델 그룹 단위
 *
 * candidates는 DB에 영속되지 않으며(item_match에 컬럼 없음), 최초 계산 시에만
 * AI 점수·근거가 포함된다. 페이지 재진입(멱등) 시 review 항목 후보는 미배정
 * 입고 그룹으로 재구성되며 점수는 0으로 채워진다.
 */
export interface MatchReviewItem {
  declaration_item_id: string;
  /** 영문 모델 */
  model: string | null;
  /** 신고수량 ㉟ */
  decl_qty: number | null;
  /** Σ 배정 입고수량 (미확정 시 null) */
  inv_qty: number | null;
  /** 대표 한글 품목명 */
  item_name: string | null;
  /** 배정 입고 행 수 */
  inv_count: number;
  /** 매칭 방법 (review 미확정 시 null) */
  method: MatchMethod | null;
  status: MatchStatus;
  score: number | null;
  /** review 항목의 점수순 입고 그룹 후보 (드롭다운 렌더용) */
  candidates?: MatchGroupCandidate[];
}

/** 환율 조회 결과 (F012) */
export interface FxRateResult {
  quote_date: string;
  currency: Currency;
  rate: number;
  source: "hana" | "smbs" | "manual";
}

/** 부대비용 안분 결과 (단일 품목, F013/F014) */
export interface ItemAllocation {
  inventory_item_id: string;
  alloc_basis: AllocBasis;
  freight: number;
  fee: number;
  etc_amount: number;
  unit_price_krw: number;
  supply_amount: number;
  vat: number;
}
