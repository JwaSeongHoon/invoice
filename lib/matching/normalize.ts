import { ITEM_CODE_MATCH_LENGTH } from "@/lib/types/constants";

/**
 * 코드 매칭 정규화 (F007, 코드 매칭 1순위)
 *
 * 정규화 = 대문자 통일 + 영숫자 외(공백·특수문자) 제거.
 * 입고 품목코드는 앞 ITEM_CODE_MATCH_LENGTH(10)자리를 모델 키로 사용한다.
 */

/** 문자열 정규화: 대문자 통일 + 영숫자 외 제거 */
export function normalizeCode(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** 입고 품목코드 → 모델 매칭 키 (앞 10자리 정규화) */
export function inventoryMatchKey(itemCode: string): string {
  return normalizeCode(itemCode.slice(0, ITEM_CODE_MATCH_LENGTH));
}

/**
 * 신고필증 모델 문자열 → 후보 키 목록
 *
 * 신고 model은 "모델번호 + 영문 설명"(예: "BA02010124 BALLOP AQUA SHOES",
 * "BOMBER-AIR BA07010027") 형태라 전체 정규화로는 입고 코드와 일치하지 않는다.
 * 공백 토큰으로 분해해 각 토큰을 정규화한 뒤, 입고 키와 교차하여 모델번호를 식별한다.
 */
export function declarationKeys(model: string): string[] {
  return model
    .split(/\s+/)
    .map(normalizeCode)
    .filter((t) => t.length > 0);
}
