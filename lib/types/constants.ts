import type { Currency } from "@/lib/types/enums";

/**
 * 업무 상수 정의 (단일 진실 공급원: docs/PRD.md 8장·F015)
 */

/** 통화코드 매핑 — 이카운트 통화코드 (USD=00001, CNY=00002) */
export const CURRENCY_CODE: Record<Currency, string> = {
  USD: "00001",
  CNY: "00002",
} as const;

/** 통화코드 → 통화 역매핑 */
export const CODE_TO_CURRENCY: Record<string, Currency> = {
  "00001": "USD",
  "00002": "CNY",
} as const;

/**
 * 이카운트 24컬럼 양식 컬럼 순서 (docs/PRD.md F015 L528-545)
 *
 * 컬럼 순서·헤더명은 고정(G4)이며 실측 입고현황.xlsx 헤더와 1:1 일치한다.
 * 자동 기입(isAuto=true): 통화·환율·단가(원화)·공급가액·부가세·적요·운반비·보관비·수수료·기타.
 * 영업팀 입력(isAuto=false, 보존): 일자·순번·거래처코드·거래처명·담당자·입고창고·거래유형·
 *   프로젝트·품목코드·품목명·규격명·수량·외화금액(외화단가 입력)·부대비용.
 * 참고: 영업팀은 외화단가를 '외화금액' 칸에 입력한다(unit_price_fx 출처). 보관비는 0 고정.
 */
export const ECOUNT_COLUMNS = [
  { key: "date", label: "일자", isAuto: false },
  { key: "seq", label: "순번", isAuto: false },
  { key: "client_code", label: "거래처코드", isAuto: false },
  { key: "client_name", label: "거래처명", isAuto: false },
  { key: "manager", label: "담당자", isAuto: false },
  { key: "warehouse", label: "입고창고", isAuto: false },
  { key: "trade_type", label: "거래유형", isAuto: false },
  { key: "currency", label: "통화", isAuto: true },
  { key: "fx_rate", label: "환율", isAuto: true },
  { key: "project", label: "프로젝트", isAuto: false },
  { key: "item_code", label: "품목코드", isAuto: false },
  { key: "item_name", label: "품목명", isAuto: false },
  { key: "spec", label: "규격명", isAuto: false },
  { key: "qty", label: "수량", isAuto: false },
  { key: "unit_price", label: "단가", isAuto: true },
  { key: "fx_amount", label: "외화금액", isAuto: false },
  { key: "supply_amount", label: "공급가액", isAuto: true },
  { key: "vat", label: "부가세", isAuto: true },
  { key: "remark", label: "적요", isAuto: true },
  { key: "extra_cost", label: "부대비용", isAuto: false },
  { key: "freight", label: "운반비", isAuto: true },
  { key: "storage", label: "보관비", isAuto: true },
  { key: "fee", label: "수수료", isAuto: true },
  { key: "etc", label: "기타", isAuto: true },
] as const;

/** 이카운트 양식 총 컬럼 수 (검증용) */
export const ECOUNT_COLUMN_COUNT = ECOUNT_COLUMNS.length;

/** Supabase Storage 비공개 버킷명 (원본 PDF/xlsx 저장) */
export const STORAGE_BUCKET = "import-files";

/** xlsx 필수 컬럼 (없으면 업로드 거부, docs/PRD.md F001) */
export const REQUIRED_XLSX_COLUMNS = ["품목코드", "품목명", "수량", "단가", "일자"] as const;

/** 품목코드 모델 매칭 키 길이 (앞 10자리) */
export const ITEM_CODE_MATCH_LENGTH = 10;

/** AI 의미매칭 자동 확정 임계값 (최고 점수 >= 0.90) */
export const AI_MATCH_THRESHOLD = 0.9;

/** AI 의미매칭 자동 확정 시 1위·2위 점수 최소 격차 (모호 매칭 방지) */
export const AI_MATCH_GAP_THRESHOLD = 0.1;

/** OCR 저신뢰 플래그 임계값 (confidence < 0.85) */
export const OCR_CONFIDENCE_THRESHOLD = 0.85;
