/**
 * document-ocr/pdf-lines — PDF 텍스트층 조각 → 사람이 읽는 줄(순수 함수, pdfjs 없이 테스트 가능).
 *
 * pdfjs 의 getTextContent 는 글자를 표 칸·단어 조각으로 주고, 순서도 화면 순서가 아니다
 * (홈택스 부가세 과세표준증명은 표 본문이 바닥 안내문 뒤에 나온다). 조각마다 줄을 바꾸면
 * "2023/01/01 · 2023/06/30 · 113,880,000" 한 줄이 세 줄로 흩어져 파서가 과세기간 줄을 못 찾는다.
 * 그래서 같은 높이(y 차이 ≤ 2pt)의 조각을 한 줄로 모아 왼쪽→오른쪽으로 잇고, 줄은 위→아래로 둔다.
 * 쪽이 여럿이면 쪽마다 따로 모은 뒤 빈 줄로 잇는다(표준재무제표는 숫자가 2쪽 이후에 있다).
 */

export type PdfTextPiece = { str: string; x: number; y: number };

const SAME_LINE_PT = 2;

export function pdfPiecesToLines(pieces: PdfTextPiece[]): string[] {
  const rows: { y: number; parts: PdfTextPiece[] }[] = [];
  const sorted = pieces
    .filter((p) => p.str.trim())
    .sort((a, b) => b.y - a.y || a.x - b.x);
  for (const p of sorted) {
    const row = rows.find((r) => Math.abs(r.y - p.y) <= SAME_LINE_PT);
    if (row) row.parts.push(p);
    else rows.push({ y: p.y, parts: [p] });
  }
  return rows.map((r) =>
    r.parts
      .sort((a, b) => a.x - b.x)
      .map((p) => p.str.trim())
      .join(" "),
  );
}

/** 쪽별 조각 → 전체 글. 쪽 사이는 빈 줄. */
export function pdfPagesToText(pages: PdfTextPiece[][]): string {
  return pages
    .map((pieces) => pdfPiecesToLines(pieces).join("\n"))
    .filter((t) => t.trim())
    .join("\n\n")
    .trim();
}
