import Anthropic from "@anthropic-ai/sdk";
import type { OcrExtractSchema } from "@/lib/types/domain";

/**
 * Claude Vision OCR 클라이언트 (F004)
 *
 * 신고필증 1페이지 PDF(base64)를 Claude에 document로 전달하고
 * 구조화 출력(output_config.format=json_schema)으로 OcrExtractSchema를 강제한다.
 * ANTHROPIC_API_KEY는 서버 전용 환경변수에서만 읽는다(클라이언트 노출 금지).
 */

/** OCR 고정밀 모델 (PRD 9장: Opus 계열 권장) */
const OCR_MODEL = "claude-opus-4-8";

/** Claude API 키 미설정 시 구분 가능한 에러 */
export class MissingApiKeyError extends Error {
  constructor() {
    super("ANTHROPIC_API_KEY가 설정되지 않았습니다.");
    this.name = "MissingApiKeyError";
  }
}

function createClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new MissingApiKeyError();
  return new Anthropic({ apiKey });
}

/** OcrExtractSchema에 대응하는 JSON Schema (structured outputs) */
const OCR_JSON_SCHEMA = {
  type: "object",
  properties: {
    declaration_no: { type: "string", description: "신고번호 ①" },
    bl_no: { type: "string", description: "B/L번호 ⑤" },
    line_items: {
      type: "array",
      description: "품목 라인. 각 행은 모델/규격(㉝), ㉟수량, ㊱단가USD, ㊲금액USD",
      items: {
        type: "object",
        properties: {
          seq: { type: "number", description: "품목 순번(란번호)" },
          model: { type: "string", description: "모델·규격 ㉝" },
          qty_35: { type: "number", description: "수량 ㉟" },
          unit_price_usd_36: { type: "number", description: "단가 USD ㊱" },
          amount_usd_37: { type: "number", description: "금액 USD ㊲" },
        },
        required: ["seq", "model", "qty_35", "unit_price_usd_36", "amount_usd_37"],
        additionalProperties: false,
      },
    },
    qty_41_total: { type: "number", description: "환급물량 수량 합계 ㊶ (문서 합계)" },
    fx_rate_65: { type: "number", description: "환율 (65)" },
    duty_rate: { type: "number", description: "관세율 (%)" },
    confidence: {
      type: "number",
      description: "추출 신뢰도 0~1. 글자가 흐리거나 불확실하면 낮게",
    },
  },
  required: [
    "declaration_no",
    "bl_no",
    "line_items",
    "qty_41_total",
    "fx_rate_65",
    "duty_rate",
    "confidence",
  ],
  additionalProperties: false,
} as const;

const OCR_PROMPT = `이 문서는 대한민국 관세청 수입신고필증(UNI-PASS 서식)의 한 페이지입니다.
표의 각 품목 란에서 다음을 정확히 추출해 JSON으로 출력하세요:
- 신고번호(①), B/L번호(⑤)
- 품목별: 순번, 모델·규격(㉝), 수량(㉟), 단가 USD(㊱), 금액 USD(㊲)
- 환급물량 수량 합계(㊶), 환율(65), 관세율(%)
- confidence: 글자가 선명하고 확신하면 1에 가깝게, 흐리거나 추정이면 낮게.
숫자는 콤마 없이 숫자만. 값이 없으면 0.`;

/**
 * 단일 신고필증 페이지(PDF base64)를 OCR하여 구조화 결과를 반환한다.
 */
export async function ocrDeclarationPage(pdfBase64: string): Promise<OcrExtractSchema> {
  const client = createClient();

  const message = await client.messages.create({
    model: OCR_MODEL,
    max_tokens: 8000,
    output_config: { format: { type: "json_schema", schema: OCR_JSON_SCHEMA } },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: { type: "base64", media_type: "application/pdf", data: pdfBase64 },
          },
          { type: "text", text: OCR_PROMPT },
        ],
      },
    ],
  });

  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("OCR 응답에서 결과를 찾지 못했습니다.");
  }
  return JSON.parse(textBlock.text) as OcrExtractSchema;
}
