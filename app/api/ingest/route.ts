import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";
import { STORAGE_BUCKET } from "@/lib/types/constants";
import { extractPdfPageTexts } from "@/lib/pdf/extract";
import { classifyPages } from "@/lib/pdf/classify";
import { parseSettlement } from "@/lib/pdf/parse-settlement";
import { parseInventoryXlsx } from "@/lib/xlsx/parse-inventory";
import type { IngestResult } from "@/lib/types/domain";
import type { Json } from "@/lib/supabase/database.types";

// pdfjs 등 네이티브 의존: Node 런타임 강제
export const runtime = "nodejs";

const PDF_MAX = 50 * 1024 * 1024; // 50MB
const XLSX_MAX = 10 * 1024 * 1024; // 10MB
const MIN_PDF_PAGES = 4;

// POST /api/ingest — 파일 수신·분류, 정산서 파싱, Storage 저장 (F001~F003)
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: claims, error: authError } = await supabase.auth.getClaims();
  if (authError || !claims?.claims) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  const userId = claims.claims.sub as string;

  // 1) 폼 데이터 수신·검증
  const formData = await request.formData();
  const pdf = formData.get("pdf");
  const xlsx = formData.get("xlsx");
  if (!(pdf instanceof File) || !(xlsx instanceof File)) {
    return NextResponse.json({ error: "PDF와 xlsx 파일을 모두 업로드해주세요." }, { status: 400 });
  }
  if (!pdf.name.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json({ error: "정산서는 PDF 파일이어야 합니다." }, { status: 400 });
  }
  if (!/\.xlsx?$/.test(xlsx.name.toLowerCase())) {
    return NextResponse.json({ error: "입고현황은 xlsx 파일이어야 합니다." }, { status: 400 });
  }
  if (pdf.size > PDF_MAX) {
    return NextResponse.json({ error: "PDF 크기는 50MB를 초과할 수 없습니다." }, { status: 400 });
  }
  if (xlsx.size > XLSX_MAX) {
    return NextResponse.json({ error: "xlsx 크기는 10MB를 초과할 수 없습니다." }, { status: 400 });
  }

  // 2) PDF 로드·페이지 분류 (Storage 저장 전 검증)
  // pdfjs가 전달 버퍼를 detach하므로 복사본을 넘기고 원본(pdfBuffer)은 업로드용으로 보존
  const pdfBuffer = new Uint8Array(await pdf.arrayBuffer());
  let pageTexts: string[];
  try {
    pageTexts = await extractPdfPageTexts(pdfBuffer.slice());
  } catch (e) {
    // 실제 원인을 Vercel 로그에 남긴다 (환경별 pdfjs 실패 진단용)
    console.error("[ingest] PDF 텍스트 추출 실패:", e);
    return NextResponse.json(
      { error: "PDF를 읽을 수 없습니다. 파일을 확인해주세요." },
      { status: 400 }
    );
  }
  if (pageTexts.length < MIN_PDF_PAGES) {
    return NextResponse.json(
      { error: `PDF는 최소 ${MIN_PDF_PAGES}페이지 이상이어야 합니다.` },
      { status: 400 }
    );
  }
  const classification = classifyPages(pageTexts);

  // 3) 정산서(1페이지) 텍스트 파싱
  const settlementPage = classification.pages.find((p) => p.kind === "settlement");
  const settlementText = settlementPage ? pageTexts[settlementPage.page_index - 1] : "";
  const settlement = parseSettlement(settlementText);

  // 3-1) 입고현황 xlsx 파싱 (필수 컬럼 검증 — 저장 전 거부) (F006)
  const xlsxBytes = new Uint8Array(await xlsx.arrayBuffer());
  let inventoryRows;
  try {
    inventoryRows = parseInventoryXlsx(xlsxBytes.slice()).rows;
  } catch (e) {
    const message = e instanceof Error ? e.message : "입고현황 xlsx를 읽을 수 없습니다.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  // 4) import_batch 생성 (status uploading)
  const { data: batch, error: batchError } = await supabase
    .from("import_batch")
    .insert({ user_id: userId, status: "uploading" })
    .select("id")
    .single();
  if (batchError || !batch) {
    return NextResponse.json({ error: "배치를 생성하지 못했습니다." }, { status: 500 });
  }
  const batchId = batch.id;

  // 5) Storage 비공개 버킷 저장 ({userId}/{batchId}/...)
  // 원본 파일명은 한글·특수문자가 많아 Storage 키 제약을 위반하므로 고정 ASCII 키 사용
  const pdfPath = `${userId}/${batchId}/source.pdf`;
  const xlsxPath = `${userId}/${batchId}/source.xlsx`;
  const pdfUpload = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(pdfPath, pdfBuffer, { contentType: "application/pdf", upsert: true });
  const xlsxUpload = await supabase.storage.from(STORAGE_BUCKET).upload(xlsxPath, xlsxBytes, {
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    upsert: true,
  });
  if (pdfUpload.error || xlsxUpload.error) {
    await supabase.from("import_batch").update({ status: "error" }).eq("id", batchId);
    return NextResponse.json({ error: "파일 저장에 실패했습니다." }, { status: 500 });
  }

  // 6) settlement 저장 (이카운트 칸 매핑은 안분 단계에서 적용)
  await supabase.from("settlement").insert({
    batch_id: batchId,
    bl_no: settlement.bl_no,
    duty_rate: settlement.duty_rate,
    freight_subtotal: settlement.freight_subtotal,
    customs_fee: settlement.customs_fee,
    customs_vat: settlement.customs_vat,
    duty_amount: settlement.duty_amount,
    raw_json: { page_text: settlementText, parsed: settlement } as unknown as Json,
  });

  // 6-1) inventory_item 저장 (행별, row_no 보존) (F006)
  if (inventoryRows.length > 0) {
    const { error: invError } = await supabase.from("inventory_item").insert(
      inventoryRows.map((row) => ({
        batch_id: batchId,
        row_no: row.row_no,
        item_code: row.item_code,
        item_name: row.item_name,
        qty: row.qty,
        unit_price_fx: row.unit_price_fx,
        currency_code: row.currency_code,
        in_date: row.in_date,
      }))
    );
    if (invError) {
      await supabase.from("import_batch").update({ status: "error" }).eq("id", batchId);
      return NextResponse.json({ error: "입고현황 저장에 실패했습니다." }, { status: 500 });
    }
  }

  // 7) 경로·상태 갱신
  await supabase
    .from("import_batch")
    .update({ pdf_path: pdfPath, xlsx_path: xlsxPath, status: "processing" })
    .eq("id", batchId);

  // 8) 분류 이상(ACE 미검출)·정산서 파싱 실패 시 사용자 확인 필요
  const needsConfirmation = !classification.ace_detected || !settlement.parsed_ok;

  const result: IngestResult = {
    batchId,
    classification,
    settlement,
    inventoryCount: inventoryRows.length,
    needs_confirmation: needsConfirmation,
  };
  return NextResponse.json(result, { status: 200 });
}
