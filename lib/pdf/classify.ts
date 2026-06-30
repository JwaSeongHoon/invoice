import type { PdfClassifyResult, PdfPageClassification, PdfPageKind } from "@/lib/types/domain";

/**
 * PDF 페이지 분류 (F002, 검증로직.md)
 *
 * 판정 규칙:
 * - 1p: 텍스트 + 정산서 키워드("수입정산서") → settlement
 * - 2~3p: 텍스트 + 세금계산서 키워드("세금계산서") → tax_invoice (skip)
 * - 4~N: 텍스트 0자(순수 이미지) → declaration (신고필증 OCR 대상)
 * - ACE 경계 문구 검출 페이지부터: 전부 skip (수입신고필증 범위 종료)
 *
 * 적용 대상 범위(검증로직.md): 4페이지부터 ACE 문구 직전까지를 신고필증으로 간주.
 */

/** 수입신고필증 범위 종료 경계 문구 */
const ACE_BOUNDARY = "ACE American Fire and Marine Insurance Company Korea";

const SETTLEMENT_KEYWORD = "수입정산서";

/** 공백을 제거해 "세 금 계 산 서"·"세금계산서" 모두 매칭 */
function hasTaxInvoiceKeyword(text: string): boolean {
  return text.replace(/\s/g, "").includes("세금계산서");
}

/** 텍스트가 사실상 비어있는지(순수 이미지 페이지) */
function isImageOnly(text: string): boolean {
  return text.replace(/\s/g, "").length === 0;
}

/**
 * 페이지별 텍스트 배열을 받아 분류 결과를 산출한다(순수 함수, 테스트 용이).
 */
export function classifyPages(pageTexts: string[]): PdfClassifyResult {
  // ACE 경계: 해당 문구가 처음 등장하는 페이지(0-based). 이후 전부 skip.
  const boundaryIndex = pageTexts.findIndex((t) => t.includes(ACE_BOUNDARY));
  const aceDetected = boundaryIndex !== -1;

  const pages: PdfPageClassification[] = pageTexts.map((text, idx) => {
    const pageIndex = idx + 1; // 1-based

    // ACE 경계 이후(경계 페이지 포함)는 전부 skip
    if (aceDetected && idx >= boundaryIndex) {
      return { page_index: pageIndex, kind: "skip" satisfies PdfPageKind };
    }

    if (text.includes(SETTLEMENT_KEYWORD)) {
      return { page_index: pageIndex, kind: "settlement" };
    }
    if (hasTaxInvoiceKeyword(text)) {
      return { page_index: pageIndex, kind: "tax_invoice" };
    }
    if (isImageOnly(text)) {
      return { page_index: pageIndex, kind: "declaration" };
    }
    // 텍스트는 있으나 키워드 불명 → skip(분류 불가)
    return { page_index: pageIndex, kind: "skip" };
  });

  return {
    total_pages: pageTexts.length,
    pages,
    ace_detected: aceDetected,
  };
}

/** 분류 결과에서 신고필증(declaration) 페이지 번호(1-based) 목록 추출 */
export function declarationPageIndexes(result: PdfClassifyResult): number[] {
  return result.pages.filter((p) => p.kind === "declaration").map((p) => p.page_index);
}
