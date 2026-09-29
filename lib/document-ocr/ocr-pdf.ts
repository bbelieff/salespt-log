/**
 * document-ocr/ocr-pdf — PDF 텍스트층 읽기(최대 pdfTextMaxPages 쪽)·첫 페이지 그리기(pdfjs-dist 6, 함수 안 dynamic import).
 * ocr-client.ts 에서 분리(500줄 캡). 출처: MoaWork app/src/lib/document-ocr/ocr-client.ts.
 */
import { OCR_LIMITS, raceWithAbort, throwIfAborted } from "./limits";
import type { OcrProgress, OcrStage } from "./types";
import { pdfPagesToText, type PdfTextPiece } from "./pdf-lines";
import { binarizeAndStripLines } from "./scan-clean";

type OnProgress = ((progress: OcrProgress) => void) | undefined;

function emit(onProgress: OnProgress, stage: OcrStage, ratio: number, message: string) {
  onProgress?.({ stage, ratio, message });
}

export async function readPdfTextLayer(
  file: Blob,
  signal: AbortSignal,
  onProgress: OnProgress,
  pdfWorkerSrc: string,
): Promise<string | null> {
  const pdfjs = (await import("pdfjs-dist")) as unknown as {
    GlobalWorkerOptions: { workerSrc: string };
    getDocument: (src: { data: ArrayBuffer }) => PdfLoadingTask;
  };
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;
  const buffer = await file.arrayBuffer();
  throwIfAborted(signal);
  // pdfjs v6: destroy()는 문서가 아니라 로딩 태스크에 있다.
  const loadingTask = pdfjs.getDocument({ data: buffer });
  let doc: PdfDocument | undefined;
  try {
    // 로딩 중 취소는 destroy로 태스크를 끊고 race로 대기를 깨운다.
    const onAbortDestroy = () => {
      void loadingTask.destroy?.().catch(() => undefined);
    };
    signal.addEventListener("abort", onAbortDestroy, { once: true });
    try {
      doc = await raceWithAbort(loadingTask.promise, signal);
    } finally {
      signal.removeEventListener("abort", onAbortDestroy);
    }
    throwIfAborted(signal);
    if (doc.numPages < 1) throw new Error("PDF에 페이지가 없어요.");
    emit(onProgress, "pdf-text", 0.1, "PDF 텍스트층 읽는 중");
    // 글자가 든 PDF 는 여러 쪽을 읽는다(표준재무제표는 숫자가 2쪽 이후). 조각은 같은 높이끼리 한 줄로.
    const pages: PdfTextPiece[][] = [];
    for (let n = 1; n <= Math.min(doc.numPages, OCR_LIMITS.pdfTextMaxPages); n += 1) {
      const page = await raceWithAbort(doc.getPage(n), signal);
      const content = await raceWithAbort(page.getTextContent(), signal);
      pages.push(
        content.items.map((item) => ({
          str: item.str ?? "",
          x: item.transform?.[4] ?? 0,
          y: item.transform?.[5] ?? 0,
        })),
      );
    }
    const layerText = pdfPagesToText(pages);
    if (layerText.replace(/\s+/g, "").length >= OCR_LIMITS.pdfTextMinChars) {
      return layerText;
    }
    return null;
  } finally {
    if (doc) await destroyPdfLoadingTask(loadingTask, doc);
    else await loadingTask.destroy?.().catch(() => undefined);
  }
}


export async function renderPdfFirstPageToBlob(
  file: Blob,
  signal: AbortSignal,
  onProgress: OnProgress,
  pdfWorkerSrc: string,
): Promise<{ blob: Blob }> {
  const pdfjs = (await import("pdfjs-dist")) as unknown as {
    GlobalWorkerOptions: { workerSrc: string };
    getDocument: (src: { data: ArrayBuffer }) => PdfLoadingTask;
  };
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;
  const buffer = await file.arrayBuffer();
  throwIfAborted(signal);
  const loadingTask = pdfjs.getDocument({ data: buffer });
  let doc: PdfDocument | undefined;
  const onAbortDestroy = () => {
    void loadingTask.destroy?.().catch(() => undefined);
  };
  signal.addEventListener("abort", onAbortDestroy, { once: true });
  try {
    doc = await raceWithAbort(loadingTask.promise, signal);
    const page = await raceWithAbort(doc.getPage(1), signal);
    emit(onProgress, "pdf-render", 0.12, "PDF 첫 페이지 그리는 중");
    const base = page.getViewport({ scale: 1 });
    const scale = Math.min(
      OCR_LIMITS.pdfRenderScale,
      OCR_LIMITS.maxImageDim / Math.max(base.width, base.height),
    );
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("PDF를 그리지 못했어요.");
    await raceWithAbort(page.render({ canvasContext: ctx, viewport }).promise, signal);
    throwIfAborted(signal);
    // 스캔 PDF — 워터마크·표 선을 지워야 표 숫자가 읽힌다(scan-clean.ts).
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
    binarizeAndStripLines(pixels.data, canvas.width, canvas.height);
    ctx.putImageData(pixels, 0, 0);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => {
        if (b) resolve(b);
        else reject(new Error("PDF 페이지를 바꾸지 못했어요."));
      }, "image/png");
    });
    canvas.width = 0;
    canvas.height = 0;
    return { blob };
  } finally {
    signal.removeEventListener("abort", onAbortDestroy);
    if (doc) await destroyPdfLoadingTask(loadingTask, doc);
    else await loadingTask.destroy?.().catch(() => undefined);
  }
}

/** pdfjs-dist v6 최소 타입. destroy()는 문서가 아니라 로딩 태스크에 있다. */
type PdfLoadingTask = {
  promise: Promise<{
    numPages: number;
    getPage: (n: number) => Promise<{
      getViewport: (opt: { scale: number }) => { width: number; height: number };
      getTextContent: () => Promise<{ items: { str?: string; transform?: number[] }[] }>;
      render: (opt: {
        canvasContext: CanvasRenderingContext2D;
        viewport: { width: number; height: number };
      }) => { promise: Promise<void> };
    }>;
  }>;
  destroy?: () => Promise<void>;
};

type PdfDocument = Awaited<PdfLoadingTask["promise"]> & {
  cleanup?: () => unknown;
};

async function destroyPdfLoadingTask(
  loadingTask: PdfLoadingTask,
  doc: PdfDocument,
): Promise<void> {
  try {
    if (typeof loadingTask.destroy === "function") {
      await loadingTask.destroy();
      return;
    }
  } catch {
    // 구버전 폴백으로 계속한다.
  }
  try {
    await doc.cleanup?.();
  } catch {
    // 정리 실패는 본 오류를 가리지 않는다.
  }
}
