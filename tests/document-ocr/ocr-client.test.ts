/**
 * ocr-client — Node 에서 확인 가능한 경로만: 파일 검증·사전 취소·에셋 경로는 same-origin 만.
 * 실제 인식(tesseract·pdfjs)은 브라우저에서만 돈다(여기서 import 되지 않는다).
 */
import { describe, expect, it } from "vitest";
import { buildOcrAssetUrls, runDocumentOcr } from "@/lib/document-ocr/ocr-client";

const manifest = {
  package: "document-ocr-assets v1",
  tesseractJs: "7.0.0",
  pdfjs: "6.3.289",
  worker: "worker.min.js",
  core: ["tesseract-core-simd-lstm.wasm.js", "tesseract-core-simd-lstm.wasm"],
  langs: ["kor", "eng"],
};

describe("ocr-client", () => {
  it("에셋은 /document-ocr 아래 same-origin 만", () => {
    expect(buildOcrAssetUrls(manifest)).toEqual({
      workerPath: "/document-ocr/worker.min.js",
      langPath: "/document-ocr/tesseract",
      corePath: "/document-ocr/tesseract/tesseract-core-simd-lstm.wasm.js",
      pdfWorkerSrc: "/document-ocr/pdf.worker.min.mjs",
    });
    expect(() => buildOcrAssetUrls({ ...manifest, worker: "https://cdn.example.com/w.js" })).toThrow();
    expect(() => buildOcrAssetUrls({ ...manifest, worker: "../w.js" })).toThrow();
    expect(() => buildOcrAssetUrls({ ...manifest, langs: [] })).toThrow();
  });

  it("형식이 안 맞으면 브라우저 없이도 바로 거절", async () => {
    const file = new File(["x"], "a.txt", { type: "text/plain" });
    await expect(runDocumentOcr(file)).rejects.toHaveProperty("code", "unsupported-type");
  });

  it("이미 취소된 요청은 시작하지 않는다", async () => {
    const ac = new AbortController();
    ac.abort(new DOMException("Aborted", "AbortError"));
    const file = new File([new Uint8Array([1])], "a.png", { type: "image/png" });
    await expect(runDocumentOcr(file, { signal: ac.signal })).rejects.toBeInstanceOf(DOMException);
  });

  it("Node(브라우저 아님)에서는 인식을 시도하지 않고 안내", async () => {
    const file = new File([new Uint8Array([1])], "a.png", { type: "image/png" });
    await expect(runDocumentOcr(file)).rejects.toThrow("브라우저");
  });
});
