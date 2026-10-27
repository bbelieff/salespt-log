/**
 * document-ocr/ocr-paddle — 브라우저 전용 PaddleOCR(PP-OCRv5 한국어) 실행기. ocr-client.ts 가 tesseract 와 함께 부른다.
 *
 * - 공식 @paddleocr/paddleocr-js 를 scripts/vendor-document-ocr.mjs 가 워커 하나(paddle-worker.js)로 묶어
 *   same-origin `/document-ocr/paddle/` 에 둔다. 모델·wasm 도 같은 곳 — 문서는 기기 밖으로 나가지 않는다.
 * - 워커는 팝업이 열린 동안 한 번만 띄워(모델 약 18MB 로드) 다음 파일에 재사용하고, 취소·실패 시 버린다.
 * - 실패는 호출한 쪽이 조용히 넘긴다 — Paddle 이 없어도 tesseract 결과로 지금처럼 동작한다.
 */
import { OCR_LIMITS, raceWithAbort } from "./limits";
import { paddleItemsToText, type PaddleItem } from "./paddle-lines";

export type PaddleManifest = {
  worker: string;
  detModel: { name: string; file: string };
  recModel: { name: string; file: string };
};

type Reply = { id: number; ok: boolean; items?: PaddleItem[]; error?: string };

let shared: { worker: Worker; ready: Promise<void>; seq: number } | null = null;

function call(worker: Worker, msg: Record<string, unknown>, id: number, signal: AbortSignal): Promise<Reply> {
  const task = new Promise<Reply>((resolve, reject) => {
    const done = () => {
      worker.removeEventListener("message", onMessage);
      worker.removeEventListener("error", onError);
    };
    const onMessage = (ev: MessageEvent<Reply>) => {
      if (ev.data?.id !== id) return;
      done();
      if (ev.data.ok) resolve(ev.data);
      else reject(new Error(ev.data.error || "paddle 실패"));
    };
    const onError = () => {
      done();
      reject(new Error("paddle 워커 오류"));
    };
    worker.addEventListener("message", onMessage);
    worker.addEventListener("error", onError);
    worker.postMessage({ ...msg, id });
  });
  return raceWithAbort(task, signal);
}

function dropShared(): void {
  shared?.worker.terminate();
  shared = null;
}

function ensureWorker(manifest: PaddleManifest, signal: AbortSignal) {
  if (shared) return shared;
  const base = new URL(`${OCR_LIMITS.assetBasePath}/paddle/`, window.location.href).href;
  const worker = new Worker(base + manifest.worker, { type: "module" });
  const config = {
    textDetectionModelName: manifest.detModel.name,
    textDetectionModelAsset: { url: base + manifest.detModel.file },
    textRecognitionModelName: manifest.recModel.name,
    textRecognitionModelAsset: { url: base + manifest.recModel.file },
    ortOptions: { backend: "wasm", wasmPaths: base },
  };
  const ready = call(worker, { type: "init", config }, 0, signal).then(() => undefined);
  shared = { worker, ready, seq: 0 };
  return shared;
}

/** 이미지 한 장을 Paddle 로 읽어 줄 글을 돌려준다. 실패·취소면 던진다(호출 측이 무시). */
export async function recognizeWithPaddle(blob: Blob, manifest: PaddleManifest, signal: AbortSignal): Promise<string> {
  const s = ensureWorker(manifest, signal);
  try {
    await raceWithAbort(s.ready, signal);
    s.seq += 1;
    const reply = await call(s.worker, { type: "run", blob }, s.seq, signal);
    return paddleItemsToText(reply.items ?? []);
  } catch (error) {
    // 취소·시간 초과·로드 실패 → 워커를 버려 다음 파일은 새로 시작한다(반쯤 죽은 워커 재사용 금지).
    dropShared();
    throw error;
  }
}

/** 팝업을 닫을 때 — 모델이 잡은 메모리를 돌려준다. */
export function releasePaddle(): void {
  dropShared();
}
