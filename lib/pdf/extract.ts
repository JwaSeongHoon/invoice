/**
 * PDF 페이지별 텍스트 레이어 추출 (F002 분류·F003 정산서 파싱 공용)
 *
 * pdfjs-dist legacy 빌드를 Node 런타임에서 워커 없이 사용한다.
 * (Route Handler는 export const runtime = "nodejs" 필수)
 * pdfjs는 대용량 ESM이므로 핸들러 호출 시 동적 import로 로드한다
 * (top-level import 시 Turbopack 개발 컴파일이 지연·정지).
 */
export async function extractPdfPageTexts(data: Uint8Array): Promise<string[]> {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  // Vercel 서버리스(Linux Node)에는 시스템 폰트·canvas(Path2D)가 없다.
  // 텍스트 레이어만 추출하므로 폰트 렌더링·eval을 모두 끄고 캔버스 의존을 피한다.
  const loadingTask = getDocument({
    data,
    useSystemFonts: false,
    disableFontFace: true,
  });
  const doc = await loadingTask.promise;

  const texts: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    texts.push(text);
  }

  await loadingTask.destroy();
  return texts;
}
