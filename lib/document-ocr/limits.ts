/**
 * document-ocr/limits — 파일·시간 상한과 취소 도구. 전부 브라우저 안에서만 강제한다(서버 전송 없음).
 * 출처: MoaWork app/src/lib/document-ocr/limits.ts (origin/main, 2026-09) — 문구만 이 앱 말투로.
 *
 * - 이미지는 JPEG/PNG/WebP 만. PDF 는 첫 페이지만 읽는다.
 * - PDF 텍스트층이 충분하면 OCR 을 건너뛰고(빠르고 정확), 부족하면 첫 페이지를 그려 OCR 한다.
 */

export const OCR_LIMITS = {
  maxFileBytes: 15 * 1024 * 1024,
  maxPages: 1,
  /** PDF 텍스트층이 이 글자 수(공백 제외) 이상이면 OCR 생략. */
  pdfTextMinChars: 30,
  /** 인식 입력 최대 변(넘으면 축소). */
  maxImageDim: 3000,
  pdfRenderScale: 2,
  ocrTimeoutMs: 120_000,
  pdfTimeoutMs: 60_000,
  /** same-origin 에셋 경로 — 런타임 CDN 호출 금지. scripts/vendor-document-ocr.mjs 가 채운다. */
  assetBasePath: "/document-ocr",
} as const;

export const OCR_ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const OCR_ACCEPT_ATTR = ".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf";

export type OcrFileKind = "image" | "pdf";

export type OcrFileError = {
  code: "empty" | "too-large" | "unsupported-type" | "aborted" | "timeout" | "unavailable";
  message: string;
};

export function validateOcrFile(file: {
  size: number;
  type: string;
  name?: string;
}): { kind: OcrFileKind } | { error: OcrFileError } {
  if (!file || file.size <= 0) {
    return { error: { code: "empty", message: "빈 파일은 읽을 수 없어요." } };
  }
  if (file.size > OCR_LIMITS.maxFileBytes) {
    return {
      error: {
        code: "too-large",
        message: `파일이 너무 커요. ${OCR_LIMITS.maxFileBytes / 1024 / 1024}MB 이하만 올릴 수 있어요.`,
      },
    };
  }
  const type = (file.type || "").toLowerCase();
  if ((OCR_ACCEPTED_IMAGE_TYPES as readonly string[]).includes(type)) return { kind: "image" };
  if (type === "application/pdf") return { kind: "pdf" };
  // type 을 비워 주는 브라우저가 있어 확장자로 한 번 더 본다.
  const name = (file.name || "").toLowerCase();
  if (/\.(jpe?g|png|webp)$/.test(name)) return { kind: "image" };
  if (/\.pdf$/.test(name)) return { kind: "pdf" };
  return {
    error: {
      code: "unsupported-type",
      message: "사진(JPG·PNG·WebP) 또는 PDF 파일만 읽을 수 있어요.",
    },
  };
}

/** AbortSignal + 타임아웃을 한 시그널로 묶는다. dispose 로 정리. */
export function withTimeout(
  outer: AbortSignal | undefined,
  ms: number,
): { signal: AbortSignal; dispose: () => void } {
  const controller = new AbortController();
  const onAbort = () => controller.abort(outer?.reason ?? new DOMException("Aborted", "AbortError"));
  let timer: ReturnType<typeof setTimeout> | undefined;
  if (outer) {
    if (outer.aborted) controller.abort(outer.reason);
    else outer.addEventListener("abort", onAbort, { once: true });
  }
  if (!controller.signal.aborted) {
    timer = setTimeout(() => {
      controller.abort(new DOMException(`시간 초과 (${Math.round(ms / 1000)}초)`, "TimeoutError"));
    }, ms);
  }
  return {
    signal: controller.signal,
    dispose: () => {
      if (timer !== undefined) clearTimeout(timer);
      outer?.removeEventListener("abort", onAbort);
    },
  };
}

export function throwIfAborted(signal?: AbortSignal): void {
  signal?.throwIfAborted();
}

/** 작업 promise 와 abort 를 경주시킨다 — terminate() 만으로는 대기가 안 끝날 수 있다. */
export function raceWithAbort<T>(task: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(signal.reason);
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(signal.reason);
    signal.addEventListener("abort", onAbort, { once: true });
    task.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener("abort", onAbort);
        reject(error);
      },
    );
  });
}

/** 읽기 실패 때 사용자에게 보이는 한 가지 문구. */
export const OCR_UNAVAILABLE_MESSAGE = "이 파일은 읽지 못했어요. 다른 사진이나 PDF로 다시 해 보세요.";

export function toOcrFileError(error: unknown): OcrFileError {
  if (error instanceof DOMException) {
    if (error.name === "AbortError") return { code: "aborted", message: "취소했어요." };
    if (error.name === "TimeoutError") {
      return { code: "timeout", message: "시간이 너무 오래 걸려 멈췄어요. 더 선명한 파일로 다시 해 보세요." };
    }
  }
  if (error instanceof Error) {
    if (/취소|abort/i.test(error.message)) return { code: "aborted", message: "취소했어요." };
  }
  // 라이브러리·에셋 오류 원문(영어·개발자 안내)은 화면에 내지 않는다.
  return { code: "unavailable", message: OCR_UNAVAILABLE_MESSAGE };
}
