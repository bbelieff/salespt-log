/**
 * 스캔 PDF OCR 전처리 — 워터마크(연한 색)·표 선 제거. 합성 픽셀만.
 * 2026-09-29: 글자층 없는 홈택스 부가세 과세표준증명이 워터마크·표 선 때문에 표 숫자를 못 읽던 문제.
 */
import { describe, expect, it } from "vitest";
import { binarizeAndStripLines } from "@/lib/document-ocr/scan-clean";
import { classifyDocumentText } from "@/lib/document-ocr/registry";

const W = 400, H = 400; // 선 판정 길이 = 폭 6%(24px)·높이 3%(12px) — 6px 글자 획보다 길다
function canvas(fill: [number, number, number]) {
  const d = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < W * H; i += 1) d.set([...fill, 255], i * 4);
  return d;
}
const put = (d: Uint8ClampedArray, x: number, y: number, rgb: [number, number, number]) => d.set([...rgb, 255], (y * W + x) * 4);
const isBlack = (d: Uint8ClampedArray, x: number, y: number) => d[(y * W + x) * 4] === 0;

describe("binarizeAndStripLines", () => {
  it("연한 워터마크는 흰색, 진한 글자 획은 검정으로 남는다", () => {
    const d = canvas([255, 255, 255]);
    put(d, 10, 10, [220, 200, 160]); // 황토색 워터마크
    for (let y = 20; y < 26; y += 1) put(d, 30, y, [20, 20, 20]); // 짧은 글자 획
    binarizeAndStripLines(d, W, H);
    expect(isBlack(d, 10, 10)).toBe(false);
    expect(isBlack(d, 30, 22)).toBe(true);
  });

  it("가로·세로로 길게 이어진 표 선은 지운다", () => {
    const d = canvas([255, 255, 255]);
    for (let x = 0; x < W; x += 1) put(d, x, 40, [0, 0, 0]); // 가로 표 선
    for (let y = 0; y < H; y += 1) put(d, 70, y, [0, 0, 0]); // 세로 표 선
    binarizeAndStripLines(d, W, H);
    expect(isBlack(d, 50, 40)).toBe(false);
    expect(isBlack(d, 70, 10)).toBe(false);
  });
});

describe("부가세 과세표준증명 판별 — 스캔 오독", () => {
  it("'증명' 을 '중명' 으로 읽어도 부가세로 판별한다", () => {
    expect(classifyDocumentText("발급번호\n부가가치세과세표준중명 처리기간")).toBe("부가세과세표준증명");
  });
});
