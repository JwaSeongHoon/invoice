import { PDFDocument } from "pdf-lib";

/**
 * 신고필증 OCR 입력 준비 (F004)
 *
 * 신고필증 페이지는 스캔 이미지이므로, 래스터화(canvas/sharp) 대신
 * pdf-lib로 해당 페이지만 1페이지 PDF로 추출하여 Claude에 document로 전달한다.
 * (네이티브 의존성 제거 + 스캔 PDF 견고성)
 */

/**
 * 원본 PDF에서 지정한 1-based 페이지를 단일 페이지 PDF(base64)로 추출한다.
 */
export async function extractPageAsPdfBase64(
  data: Uint8Array,
  pageIndex1Based: number
): Promise<string> {
  const src = await PDFDocument.load(data);
  const out = await PDFDocument.create();
  const [page] = await out.copyPages(src, [pageIndex1Based - 1]);
  out.addPage(page);
  const bytes = await out.save();
  return Buffer.from(bytes).toString("base64");
}
