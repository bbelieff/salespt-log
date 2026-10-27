/**
 * paddle-worker.mjs — PaddleOCR 브라우저 워커 원본. scripts/vendor-document-ocr.mjs 가 esbuild 로
 * public/document-ocr/paddle/paddle-worker.js 한 파일로 묶는다(Next 번들에 넣지 않는다 — opencv 10MB).
 * lib/document-ocr/ocr-paddle.ts 가 { type: "init", config } → { type: "run", blob } 를 보낸다.
 * 인식 글자는 로그로 남기지 않는다(개인정보).
 */
import { PaddleOCR } from "@paddleocr/paddleocr-js";

// 워커에는 DOM 이 없다 — SDK·opencv 는 그림판(canvas)만 빌려 쓰므로 OffscreenCanvas 로 대신한다(2026-10-28 실측).
if (typeof document === "undefined") globalThis.document = { createElement: () => new OffscreenCanvas(1, 1) };
if (typeof HTMLImageElement === "undefined") globalThis.HTMLImageElement = class {};
if (typeof HTMLCanvasElement === "undefined") globalThis.HTMLCanvasElement = OffscreenCanvas;

let ready = null;

self.onmessage = async (ev) => {
  const { id, type, config, blob } = ev.data ?? {};
  try {
    if (type === "init") {
      ready ??= PaddleOCR.create(config);
      await ready;
      self.postMessage({ id, ok: true });
      return;
    }
    const ocr = await ready;
    const [result] = await ocr.predict(blob);
    const items = (result?.items ?? []).map((i) => ({ text: i.text, poly: i.poly }));
    self.postMessage({ id, ok: true, items });
  } catch (error) {
    self.postMessage({ id, ok: false, error: String((error && error.message) || error) });
  }
};
