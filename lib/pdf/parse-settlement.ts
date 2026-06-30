import type { ParsedSettlement } from "@/lib/types/domain";

/**
 * 수입정산서 1페이지 텍스트 파싱 (F003, 명일로지스 서식 기준)
 *
 * 추출 대상: B/L번호·관세율·통관수수료·통관부가세·관세·업무운임 SUB TOTAL.
 * 이카운트 칸 매핑(shrimp-rules 6.2)은 안분 단계(Task 014)에서 적용:
 *   운반비 = 통관수수료 + 업무운임 SUB TOTAL, 수수료 = 통관부가세, 기타 = 관세.
 *
 * CID 폰트 한글 깨짐(OI-3) 등으로 핵심 라벨을 못 찾으면 parsed_ok=false →
 * 호출부에서 needs_confirmation 처리(실제 Vision 폴백은 Task 007 이후).
 */

/** "8,878,190" → 8878190, 실패 시 null */
function parseAmount(raw: string | undefined): number | null {
  if (!raw) return null;
  const n = Number(raw.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

/** 첫 번째 캡처 그룹을 반환 */
function match1(text: string, re: RegExp): string | undefined {
  return text.match(re)?.[1];
}

export function parseSettlement(text: string): ParsedSettlement {
  // B/L번호: 영문자+숫자 12자 이상 토큰 중 문자·숫자 혼합 (예: XMCCLINC26050074)
  let bl_no: string | null = null;
  for (const token of text.match(/\b[A-Z0-9]{12,}\b/g) ?? []) {
    if (/[A-Z]/.test(token) && /[0-9]/.test(token)) {
      bl_no = token;
      break;
    }
  }

  const duty_rate = parseAmount(match1(text, /관세율\s*([\d.,]+)\s*%/));
  // "KRW 관세 8,878,190" — 관세율과 구분 위해 KRW 접두 요구
  const duty_amount = parseAmount(match1(text, /KRW\s*관세\s+([\d,]+)/));
  const customs_vat = parseAmount(match1(text, /통관부가세\s+([\d,]+)/));
  const customs_fee = parseAmount(match1(text, /통관수수료\s+([\d,]+)/));
  // "1,230.00 2,758,088 58,850 [ 업무운임 SUB TOTAL ]" → 공급가액(중간 값)
  const freight_subtotal = parseAmount(
    match1(text, /[\d.,]+\s+([\d,]+)\s+[\d,]+\s*\[\s*업무운임\s*SUB\s*TOTAL/)
  );

  const parsed_ok =
    bl_no !== null && duty_amount !== null && customs_vat !== null && customs_fee !== null;

  return {
    bl_no,
    duty_rate,
    freight_subtotal,
    customs_fee,
    customs_vat,
    duty_amount,
    parsed_ok,
  };
}
