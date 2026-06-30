import type { MatchMethod, ValidationType } from "@/lib/types/enums";

/**
 * 검증 리포트 생성 (F016)
 *
 * 검증 3종(㉟=㊶·단가 역산·안분 합계) 결과 + 매칭 방법 요약(코드/AI/수동) +
 * OCR 저신뢰(confidence < 0.85) 목록을 사람이 읽는 한글 텍스트로 정리한다.
 */

export interface ReportValidation {
  type: ValidationType;
  passed: boolean;
  expected: number | null;
  actual: number | null;
}

export interface ReportInput {
  validations: ReportValidation[];
  /** 매칭 방법별 건수 */
  matchCounts: Record<MatchMethod, number>;
  /** OCR 저신뢰 페이지 (confidence < 0.85) */
  lowConfidence: { page_index: number; confidence: number | null }[];
}

const VALIDATION_LABEL: Record<ValidationType, string> = {
  qty3541: "수량 검증(㉟=㊶)",
  unitprice: "외화단가 역산 보정",
  alloc_freight: "운반비 안분 합계",
  alloc_fee: "수수료 안분 합계",
  alloc_etc: "기타 안분 합계",
};

function fmt(value: number | null): string {
  return value === null ? "-" : value.toLocaleString("ko-KR");
}

/** 검증 리포트 텍스트(UTF-8)를 생성한다. */
export function buildValidationReport(input: ReportInput): string {
  const lines: string[] = [];
  lines.push("=== 수입정산 검증 리포트 ===", "");

  lines.push("[검증 결과]");
  for (const v of input.validations) {
    const status = v.passed ? "통과" : "불일치";
    lines.push(
      `- ${VALIDATION_LABEL[v.type]}: ${status} (기대=${fmt(v.expected)}, 실제=${fmt(v.actual)})`
    );
  }
  lines.push("");

  lines.push("[매칭 방법 요약]");
  lines.push(`- 코드 매칭: ${input.matchCounts.code}건`);
  lines.push(`- AI 의미 매칭: ${input.matchCounts.ai}건`);
  lines.push(`- 수동 확정: ${input.matchCounts.manual}건`);
  lines.push("");

  lines.push("[OCR 저신뢰 목록 (confidence < 0.85)]");
  if (input.lowConfidence.length === 0) {
    lines.push("- 없음");
  } else {
    for (const lc of input.lowConfidence) {
      lines.push(`- ${lc.page_index + 1}페이지: confidence=${fmt(lc.confidence)}`);
    }
  }
  lines.push("");

  return lines.join("\n");
}
