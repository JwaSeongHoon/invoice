/**
 * 업무 도메인 고정 enum 문자열 (단일 진실 공급원: docs/PRD.md 8장, shrimp-rules.md 5.1)
 *
 * ⚠️ 아래 리터럴 문자열은 DB 컬럼 값·이카운트 양식과 직접 매핑되므로 임의 변경 금지.
 * 변경이 필요하면 docs/PRD.md 8장을 먼저 수정 제안할 것.
 */

/** import_batch.status — 정산 처리 배치 상태 */
export type BatchStatus = "uploading" | "processing" | "matching" | "done" | "error";

/** item_match.method — 매칭 방법 */
export type MatchMethod = "code" | "ai" | "manual";

/** item_match.status — 매칭 상태 */
export type MatchStatus = "match" | "mismatch" | "review";

/** fx_rate_cache.source — 환율 출처 */
export type FxSource = "hana" | "smbs" | "manual";

/** validation_log.type — 검증 종류 */
export type ValidationType = "qty3541" | "unitprice" | "alloc_freight" | "alloc_fee" | "alloc_etc";

/** allocation_result.alloc_basis — 안분 기준 (신고수량/입고수량) */
export type AllocBasis = "decl" | "inventory";

/** 통화 (이카운트 통화코드 매핑 키) */
export type Currency = "USD" | "CNY";
