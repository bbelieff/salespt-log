/**
 * document-ocr/paddle-lines — PaddleOCR 글자 상자들을 사람이 읽는 순서의 줄 글로 바꾼다.
 *
 * Paddle 은 「등록번호 : 214-…」처럼 한 줄도 칸마다 상자를 따로 준다. 파서는 줄 단위로 읽으므로
 * 상자 높이의 절반 이상 겹치는 상자를 한 줄로 묶고, 줄 안에서는 왼쪽부터 띄어 쓴다.
 * 순수 함수 — 브라우저·Node 둘 다(테스트 가능).
 */

export type PaddleItem = { text: string; poly: number[][] };

type Box = { text: string; x0: number; cy: number; h: number };

function toBox(item: PaddleItem): Box | null {
  const text = item.text.trim();
  if (!text || item.poly.length === 0) return null;
  const xs = item.poly.map((p) => p[0] ?? 0);
  const ys = item.poly.map((p) => p[1] ?? 0);
  const y0 = Math.min(...ys);
  const y1 = Math.max(...ys);
  return { text, x0: Math.min(...xs), cy: (y0 + y1) / 2, h: Math.max(1, y1 - y0) };
}

export function paddleItemsToText(items: PaddleItem[]): string {
  const boxes = items.map(toBox).filter((b): b is Box => b !== null).sort((a, b) => a.cy - b.cy);
  const lines: { cy: number; h: number; boxes: Box[] }[] = [];
  for (const b of boxes) {
    const line = lines[lines.length - 1];
    if (line && Math.abs(b.cy - line.cy) < Math.min(b.h, line.h) / 2) {
      line.boxes.push(b);
      continue;
    }
    lines.push({ cy: b.cy, h: b.h, boxes: [b] });
  }
  return lines
    .map((l) => l.boxes.sort((a, b) => a.x0 - b.x0).map((b) => b.text).join(" "))
    .join("\n");
}
