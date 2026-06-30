import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";
import { STORAGE_BUCKET } from "@/lib/types/constants";
import { extractPdfPageTexts } from "@/lib/pdf/extract";
import { classifyPages, declarationPageIndexes } from "@/lib/pdf/classify";
import { extractPageAsPdfBase64 } from "@/lib/ocr/extract-pages";
import { ocrDeclarationPage, MissingApiKeyError } from "@/lib/ocr/anthropic";

// pdf-lib·Claude SDK: Node 런타임 강제
export const runtime = "nodejs";
// OCR은 다중 페이지 병렬 처리로 시간이 걸릴 수 있음
export const maxDuration = 120;

// POST /api/ocr — 신고필증 Claude Vision OCR (F004, AC-06)
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: claims, error: authError } = await supabase.auth.getClaims();
  if (authError || !claims?.claims) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { batchId?: string } | null;
  const batchId = body?.batchId;
  if (!batchId) {
    return NextResponse.json({ error: "batchId가 필요합니다." }, { status: 400 });
  }

  // 1) 배치·PDF 경로 조회 (RLS로 본인 배치만)
  const { data: batch, error: batchError } = await supabase
    .from("import_batch")
    .select("id, pdf_path")
    .eq("id", batchId)
    .single();
  if (batchError || !batch?.pdf_path) {
    return NextResponse.json({ error: "배치를 찾을 수 없습니다." }, { status: 404 });
  }

  // 2) Storage에서 PDF 다운로드
  const download = await supabase.storage.from(STORAGE_BUCKET).download(batch.pdf_path);
  if (download.error || !download.data) {
    return NextResponse.json({ error: "원본 PDF를 불러오지 못했습니다." }, { status: 500 });
  }
  const pdfBytes = new Uint8Array(await download.data.arrayBuffer());

  // 3) 분류 → 신고필증 페이지 목록
  const classification = classifyPages(await extractPdfPageTexts(pdfBytes.slice()));
  const pages = declarationPageIndexes(classification);
  if (pages.length === 0) {
    return NextResponse.json({ error: "신고필증 페이지를 찾을 수 없습니다." }, { status: 422 });
  }

  // 4) 페이지 병렬 OCR (Claude Vision)
  let results;
  try {
    results = await Promise.all(
      pages.map(async (pageIndex) => {
        const pageBase64 = await extractPageAsPdfBase64(pdfBytes.slice(), pageIndex);
        const ocr = await ocrDeclarationPage(pageBase64);
        return { pageIndex, ocr };
      })
    );
  } catch (e) {
    if (e instanceof MissingApiKeyError) {
      return NextResponse.json(
        { error: "OCR 기능이 구성되지 않았습니다(ANTHROPIC_API_KEY 누락)." },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: "OCR 처리 중 오류가 발생했습니다." }, { status: 500 });
  }

  // 5) declaration_item 저장 (라인별 행, 페이지 단위 필드 중복 저장)
  // 재처리 멱등성: 기존 신고필증 행 제거 후 삽입
  await supabase.from("declaration_item").delete().eq("batch_id", batchId);

  const rows = results.flatMap(({ pageIndex, ocr }) =>
    ocr.line_items.map((li) => ({
      batch_id: batchId,
      page_index: pageIndex,
      declaration_no: ocr.declaration_no,
      bl_no: ocr.bl_no,
      model: li.model,
      qty_35: li.qty_35,
      unit_price_usd: li.unit_price_usd_36,
      amount_usd: li.amount_usd_37,
      qty_41_total: ocr.qty_41_total,
      fx_rate_65: ocr.fx_rate_65,
      confidence: ocr.confidence,
    }))
  );

  if (rows.length > 0) {
    const { error: insError } = await supabase.from("declaration_item").insert(rows);
    if (insError) {
      return NextResponse.json({ error: "OCR 결과 저장에 실패했습니다." }, { status: 500 });
    }
  }

  // 6) 저신뢰 페이지 요약 (confidence < 0.85, AC-06)
  const lowConfidencePages = results
    .filter((r) => (r.ocr.confidence ?? 0) < 0.85)
    .map((r) => r.pageIndex);

  return NextResponse.json(
    {
      batchId,
      pages: results.map((r) => ({
        page_index: r.pageIndex,
        line_count: r.ocr.line_items.length,
        qty_41_total: r.ocr.qty_41_total,
        fx_rate_65: r.ocr.fx_rate_65,
        confidence: r.ocr.confidence,
      })),
      itemCount: rows.length,
      lowConfidencePages,
    },
    { status: 200 }
  );
}
