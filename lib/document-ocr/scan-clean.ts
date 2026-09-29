/**
 * document-ocr/scan-clean — 스캔 PDF 를 OCR 하기 전 이미지 정리(순수 함수, 캔버스 없이 테스트 가능).
 *
 * 2026-09-29 belie 제보: 글자층 없는 홈택스 부가세 과세표준증명(스캔 PDF)이 "과세기간별 금액을 찾지 못했어요".
 * 로컬 재현 결과 원인 두 가지 —
 *  ① 표 뒤 국세청 워터마크(연한 황토색 문양)가 숫자와 겹쳐 인식이 한글 잡음으로 바뀐다.
 *  ② 표 칸 선(가로·세로 긴 선)이 숫자에 붙어 한 줄이 통째로 깨진다.
 * 그래서 ① 밝기 기준으로 흑백만 남기고(연한 워터마크는 흰색이 된다) ② 한 방향으로 길게 이어진 검은 줄
 * (가로는 폭의 6%, 세로는 높이의 3% 이상)을 지운다. 글자 획은 이보다 훨씬 짧아 남는다.
 * 사진(조명 불균일)에는 쓰지 않는다 — PDF 를 그린 깨끗한 화면에만.
 */

export type ScanCleanOptions = {
  /** 이 밝기(0~255)보다 어두운 점만 글자로 본다. */
  threshold?: number;
  /** 가로 선으로 볼 최소 길이(폭 대비). */
  minHorizontalRatio?: number;
  /** 세로 선으로 볼 최소 길이(높이 대비). */
  minVerticalRatio?: number;
};

/** RGBA 픽셀 배열을 제자리에서 흑백으로 바꾸고 표 선을 지운다. */
export function binarizeAndStripLines(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  opts: ScanCleanOptions = {},
): void {
  const threshold = opts.threshold ?? 150;
  const minH = Math.max(2, Math.round(width * (opts.minHorizontalRatio ?? 0.06)));
  const minV = Math.max(2, Math.round(height * (opts.minVerticalRatio ?? 0.03)));
  const size = width * height;
  const dark = new Uint8Array(size);
  for (let i = 0; i < size; i += 1) {
    const g = 0.299 * data[i * 4]! + 0.587 * data[i * 4 + 1]! + 0.114 * data[i * 4 + 2]!;
    dark[i] = g < threshold ? 1 : 0;
  }
  const line = new Uint8Array(size);
  for (let y = 0; y < height; y += 1) {
    let run = 0;
    for (let x = 0; x <= width; x += 1) {
      if (x < width && dark[y * width + x]) run += 1;
      else {
        if (run >= minH) for (let k = x - run; k < x; k += 1) line[y * width + k] = 1;
        run = 0;
      }
    }
  }
  for (let x = 0; x < width; x += 1) {
    let run = 0;
    for (let y = 0; y <= height; y += 1) {
      if (y < height && dark[y * width + x]) run += 1;
      else {
        if (run >= minV) for (let k = y - run; k < y; k += 1) line[k * width + x] = 1;
        run = 0;
      }
    }
  }
  for (let i = 0; i < size; i += 1) {
    const v = dark[i] && !line[i] ? 0 : 255;
    data[i * 4] = v;
    data[i * 4 + 1] = v;
    data[i * 4 + 2] = v;
    data[i * 4 + 3] = 255;
  }
}
