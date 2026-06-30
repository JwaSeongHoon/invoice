import Anthropic from "@anthropic-ai/sdk";

/**
 * Claude 의미 매칭 클라이언트 (F008, AI 의미매칭 2순위)
 *
 * 코드 매칭에 실패한 영문 모델을, 미배정 입고 품목 그룹(키 단위)과 의미적으로 비교하여
 * 그룹별 0~1 점수와 근거를 구조화 출력(json_schema)으로 강제한다.
 * 비용·지연 절감을 위해 경량 모델(Sonnet 계열)을 사용한다.
 * ANTHROPIC_API_KEY는 서버 전용 환경변수에서만 읽는다(클라이언트 노출 금지).
 */

/** 의미 매칭 경량 모델 (PRD 9장: Sonnet 계열 권장) */
const MATCH_MODEL = "claude-sonnet-4-6";

/** Claude API 키 미설정 시 구분 가능한 에러 */
export class MissingApiKeyError extends Error {
  constructor() {
    super("ANTHROPIC_API_KEY가 설정되지 않았습니다.");
    this.name = "MissingApiKeyError";
  }
}

function createAnthropicClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new MissingApiKeyError();
  return new Anthropic({ apiKey });
}

/** 의미 매칭 후보 입력 (입고 키 그룹 — 키 + 대표 한글 품목명) */
export interface SemanticGroup {
  inventory_key: string;
  item_name: string;
}

/** 의미 매칭 후보 결과 (키 단위 점수) */
export interface SemanticScore {
  inventory_key: string;
  score: number;
  reason: string;
}

/** SemanticScore에 대응하는 JSON Schema (structured outputs) */
const MATCH_JSON_SCHEMA = {
  type: "object",
  properties: {
    candidates: {
      type: "array",
      description: "각 입고 품목 그룹에 대한 의미 유사도 평가",
      items: {
        type: "object",
        properties: {
          inventory_key: { type: "string", description: "후보 입고 키" },
          score: { type: "number", description: "0~1 의미 유사도 (1=확신)" },
          reason: { type: "string", description: "한글 매칭 근거(간결)" },
        },
        required: ["inventory_key", "score", "reason"],
        additionalProperties: false,
      },
    },
  },
  required: ["candidates"],
  additionalProperties: false,
} as const;

interface MatchSchemaResult {
  candidates: SemanticScore[];
}

/**
 * 영문 모델 1건을 미배정 입고 그룹과 의미 매칭하여 점수(내림차순)를 반환한다.
 * 후보가 없으면 빈 배열을 반환한다.
 */
export async function matchSemantic(
  model: string,
  groups: SemanticGroup[]
): Promise<SemanticScore[]> {
  if (groups.length === 0) return [];

  const client = createAnthropicClient();

  const groupList = groups.map((g) => `- key=${g.inventory_key}: ${g.item_name}`).join("\n");
  const prompt = `영문 수입신고필증의 모델과 한글 입고현황 품목을 의미적으로 매칭합니다.
영문 모델: "${model}"

아래 한글 입고 품목 후보(키 단위) 각각에 0~1 유사도 점수와 한글 근거를 매기세요.
브랜드·제품군·기능 키워드가 일치할수록 높게, 무관하면 낮게 평가하세요.

후보 목록:
${groupList}

모든 후보를 candidates 배열에 포함하여 출력하세요.`;

  const message = await client.messages.create({
    model: MATCH_MODEL,
    max_tokens: 4000,
    output_config: { format: { type: "json_schema", schema: MATCH_JSON_SCHEMA } },
    messages: [{ role: "user", content: [{ type: "text", text: prompt }] }],
  });

  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("의미 매칭 응답에서 결과를 찾지 못했습니다.");
  }
  const parsed = JSON.parse(textBlock.text) as MatchSchemaResult;
  return [...parsed.candidates].sort((a, b) => b.score - a.score);
}
