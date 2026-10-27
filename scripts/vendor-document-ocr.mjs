#!/usr/bin/env node
/**
 * vendor-document-ocr.mjs — 브라우저 OCR 자체호스팅 에셋을 node_modules에서
 * public/document-ocr 로 복사하고 manifest.json을 쓴다.
 * 출처: MoaWork app/scripts/vendor-document-ocr.mjs (origin/main) — 경로만 이 레포(단일 패키지) 기준.
 * 업체정보 「문서로 자동입력」(docs/plans/active/company-doc-autofill.md) 이 쓴다.
 *
 * 원칙:
 * - 공인 npm 패키지에서만 가져온다 (네트워크 다운로드 없음, 이 스크립트는
 *   로컬 node_modules만 읽는다).
 * - 런타임 CDN 호출 금지: worker·core·언어·pdf worker 전부 same-origin.
 * - 바이너리는 git에 넣지 않는다. `npm run build`가 먼저 이 스크립트를
 *   실행하므로 VPS/CI도 hermetic하게 재생성된다.
 * - 언어 데이터는 LSTM 전용 best_int (기본 OEM=LSTM_ONLY와 같은 조합).
 *   worker에는 gzip:true로 넘기므로 *.traineddata.gz 파일명을 그대로 둔다.
 *
 * 출처 (모두 Apache-2.0):
 * - tesseract.js 7.0.0 ......... https://registry.npmjs.org/tesseract.js/-/tesseract.js-7.0.0.tgz
 * - tesseract.js-core 7.0.0 ..... https://registry.npmjs.org/tesseract.js-core/-/tesseract.js-core-7.0.0.tgz
 * - pdfjs-dist 6.3.289 .......... https://registry.npmjs.org/pdfjs-dist/-/pdfjs-dist-6.3.289.tgz
 * - @tesseract.js-data/kor 1.0.0  https://registry.npmjs.org/@tesseract.js-data/kor/-/kor-1.0.0.tgz
 *                                 (원본: https://github.com/tesseract-ocr/tessdata_fast, Apache-2.0)
 * - @tesseract.js-data/eng 1.0.0  https://registry.npmjs.org/@tesseract.js-data/eng/-/eng-1.0.0.tgz
 *
 * 용량 안내 (vendor 실행 시 실제 bytes 출력):
 * - tesseract-core-simd-lstm 1쌍(js+wasm) 약 6.8MB — 대부분 데스크톱/모바일
 *   브라우저의 WASM SIMD를 가정한다. 미지원 기기는 인식 단계에서 오류로
 *   안내되며 (조용히 틀린 값을 내지 않는다), 필요시 plain-lstm 쌍을 추가
 *   벤더하도록 manifest.core에 확장한다.
 * - kor best_int .gz 약 1.6MB, eng best_int .gz 약 2.9MB.
 *
 * PaddleOCR(2026-10-28, 사진·스캔을 tesseract 와 함께 한 번 더 읽는다 — lib/document-ocr/ocr-paddle.ts):
 * - @paddleocr/paddleocr-js 0.4.2(공식 PaddlePaddle, Apache-2.0) + onnxruntime-web 1.31.1(MIT)을
 *   scripts/document-ocr/paddle-worker.mjs 에서 esbuild 로 워커 한 파일로 묶는다(약 10MB, opencv 포함).
 * - 모델(PP-OCRv5 mobile det 4.8MB · korean rec 13.5MB)은 npm 에 없어 공식 배포 주소에서 받는다 —
 *   **이 스크립트의 유일한 네트워크 예외.** sha256 을 아래에 고정해 바뀐 파일은 거부하고,
 *   `.cache/document-ocr/` 에 보관해 다음 빌드는 받지 않는다. 받기에 실패하면 경고만 남기고
 *   manifest 에서 paddle 을 빼 tesseract 만으로 동작한다(빌드는 깨지지 않는다).
 */

import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const appDir = resolve(here, ".."); // 레포 루트
const outDir = join(appDir, "public", "document-ocr");
const tesseractDir = join(outDir, "tesseract");

const CHECK = process.argv.includes("--check");

function findPackageDir(name) {
  let dir = appDir;
  for (let i = 0; i < 6; i += 1) {
    const candidate = join(dir, "node_modules", name);
    if (existsSync(join(candidate, "package.json"))) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(
    `node_modules에서 '${name}'을 찾지 못했습니다. 레포 루트에서 npm ci를 먼저 실행하세요.`,
  );
}

function pkgVersion(name) {
  const raw = readFileSync(join(findPackageDir(name), "package.json"), "utf8");
  return JSON.parse(raw).version;
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

/** Paddle 모델 — 공식 배포 파일, sha256 고정(2026-10-28 받은 값). */
const PADDLE_BASE = "https://paddle-model-ecology.bj.bcebos.com/paddlex/official_inference_model/paddle3.0.0";
const PADDLE_MODELS = [
  { role: "det", name: "PP-OCRv5_mobile_det", file: "PP-OCRv5_mobile_det_onnx_infer.tar", sha256: "781056046c9ed77a15c94681605db6a0f62317c2e9cce6931c71da2478d4bc30" },
  { role: "rec", name: "korean_PP-OCRv5_mobile_rec", file: "korean_PP-OCRv5_mobile_rec_onnx_infer.tar", sha256: "568ed8b43a260adc9f484d92105e425ea8cddf8ce16940c177bc12864cfb0eb0" },
].map((m) => ({ ...m, url: `${PADDLE_BASE}/${m.file}` }));
const paddleDir = join(outDir, "paddle");
const modelCache = join(appDir, ".cache", "document-ocr");

async function cachedModel(m) {
  const path = join(modelCache, m.file);
  if (existsSync(path) && sha256(path) === m.sha256) return path;
  mkdirSync(modelCache, { recursive: true });
  const res = await fetch(m.url, { signal: AbortSignal.timeout(180_000) });
  if (!res.ok) throw new Error(`${m.file} HTTP ${res.status}`);
  const tmp = `${path}.part`;
  writeFileSync(tmp, Buffer.from(await res.arrayBuffer()));
  if (sha256(tmp) !== m.sha256) throw new Error(`${m.file} sha256 불일치 — 배포 파일이 바뀌었습니다.`);
  renameSync(tmp, path);
  return path;
}

/** Paddle 워커 번들 + ort wasm + 모델. 실패하면 null(경고) — tesseract 만으로 동작. */
async function vendorPaddle() {
  try {
    const models = [];
    for (const m of PADDLE_MODELS) models.push([await cachedModel(m), join(paddleDir, m.file)]);
    const ortDist = join(findPackageDir("onnxruntime-web"), "dist");
    const ort = ["ort-wasm-simd-threaded.mjs", "ort-wasm-simd-threaded.wasm"].map((f) => [join(ortDist, f), join(paddleDir, f)]);
    const workerOut = join(modelCache, "paddle-worker.js");
    if (!CHECK) {
      const { build } = await import("esbuild");
      await build({
        entryPoints: [join(here, "document-ocr", "paddle-worker.mjs")],
        outfile: workerOut,
        bundle: true,
        format: "esm",
        minify: true,
        platform: "browser",
        legalComments: "none",
        logLevel: "warning",
        // opencv.js 의 Node 분기만 부르는 모듈 — 브라우저에선 안 닿는다.
        external: ["fs", "path", "crypto", "worker_threads"],
        // 기본 onnxruntime-web 은 WebGPU(jsep) wasm 29MB 를 부른다 — wasm 전용 빌드(14.8MB)로.
        alias: { "onnxruntime-web": "onnxruntime-web/wasm" },
      });
    }
    return {
      plan: [[workerOut, join(paddleDir, "paddle-worker.js")], ...ort, ...models],
      manifest: {
        worker: "paddle-worker.js",
        detModel: { name: PADDLE_MODELS[0].name, file: PADDLE_MODELS[0].file },
        recModel: { name: PADDLE_MODELS[1].name, file: PADDLE_MODELS[1].file },
      },
    };
  } catch (error) {
    console.warn(`vendor:document-ocr: ⚠ PaddleOCR 에셋 준비 실패 — tesseract 만 씁니다 (${error instanceof Error ? error.message : error})`);
    return null;
  }
}

/** [소스패키지/소스경로, 출력경로] */
const tessJs = findPackageDir("tesseract.js");
const tessCore = findPackageDir("tesseract.js-core");
const pdfjs = findPackageDir("pdfjs-dist");
const korData = findPackageDir("@tesseract.js-data/kor");
const engData = findPackageDir("@tesseract.js-data/eng");

const coreJs = "tesseract-core-simd-lstm.wasm.js";
const coreWasm = "tesseract-core-simd-lstm.wasm";

const plan = [
  [join(tessJs, "dist", "worker.min.js"), join(outDir, "worker.min.js")],
  [join(tessCore, coreJs), join(tesseractDir, coreJs)],
  [join(tessCore, coreWasm), join(tesseractDir, coreWasm)],
  [
    join(korData, "4.0.0_best_int", "kor.traineddata.gz"),
    join(tesseractDir, "kor.traineddata.gz"),
  ],
  [
    join(engData, "4.0.0_best_int", "eng.traineddata.gz"),
    join(tesseractDir, "eng.traineddata.gz"),
  ],
  [join(pdfjs, "build", "pdf.worker.min.mjs"), join(outDir, "pdf.worker.min.mjs")],
];

const tesseractJsVersion = pkgVersion("tesseract.js");
const tesseractCoreVersion = pkgVersion("tesseract.js-core");
const pdfjsVersion = pkgVersion("pdfjs-dist");

const manifest = {
  package: "document-ocr-assets v1",
  tesseractJs: tesseractJsVersion,
  tesseractCore: tesseractCoreVersion,
  pdfjs: pdfjsVersion,
  worker: "worker.min.js",
  core: [coreJs, coreWasm],
  langs: ["kor", "eng"],
  langVariant: "4.0.0_best_int",
  gzip: true,
  license: "Apache-2.0",
  sources: {
    "tesseract.js": `https://registry.npmjs.org/tesseract.js/-/tesseract.js-${tesseractJsVersion}.tgz`,
    "tesseract.js-core": `https://registry.npmjs.org/tesseract.js-core/-/tesseract.js-core-${tesseractCoreVersion}.tgz`,
    "pdfjs-dist": `https://registry.npmjs.org/pdfjs-dist/-/pdfjs-dist-${pdfjsVersion}.tgz`,
    "@tesseract.js-data/kor":
      "https://registry.npmjs.org/@tesseract.js-data/kor/-/kor-1.0.0.tgz (원본: https://github.com/tesseract-ocr/tessdata_fast)",
    "@tesseract.js-data/eng":
      "https://registry.npmjs.org/@tesseract.js-data/eng/-/eng-1.0.0.tgz (원본: https://github.com/tesseract-ocr/tessdata_fast)",
  },
};

function fail(message) {
  console.error(`vendor:document-ocr: ${message}`);
  process.exit(1);
}

for (const [src] of plan) {
  if (!existsSync(src)) fail(`소스 없음: ${src}`);
}

if (CHECK) {
  const manifestPath = join(outDir, "manifest.json");
  if (!existsSync(manifestPath)) fail("manifest.json 없음 — vendor를 먼저 실행하세요.");
  const current = JSON.parse(readFileSync(manifestPath, "utf8"));
  for (const key of ["tesseractJs", "tesseractCore", "pdfjs", "worker", "langVariant"]) {
    if (current[key] !== manifest[key]) {
      fail(`manifest 불일치(${key}): ${current[key]} !== ${manifest[key]} — vendor를 다시 실행하세요.`);
    }
  }
  for (const [src, dest] of plan) {
    if (!existsSync(dest)) fail(`에셋 없음: ${dest}`);
    if (sha256(src) !== sha256(dest)) fail(`에셋 stale: ${dest} — vendor를 다시 실행하세요.`);
  }
  console.log("vendor:document-ocr --check OK");
  process.exit(0);
}

mkdirSync(tesseractDir, { recursive: true });
const files = [];
const paddle = await vendorPaddle();
if (paddle) {
  manifest.paddle = paddle.manifest;
  manifest.sources["@paddleocr/paddleocr-js"] = `https://registry.npmjs.org/@paddleocr/paddleocr-js/-/paddleocr-js-${pkgVersion("@paddleocr/paddleocr-js")}.tgz`;
  manifest.sources["onnxruntime-web"] = `https://registry.npmjs.org/onnxruntime-web/-/onnxruntime-web-${pkgVersion("onnxruntime-web")}.tgz`;
  for (const m of PADDLE_MODELS) manifest.sources[m.file] = m.url;
  plan.push(...paddle.plan);
}
for (const [src, dest] of plan) {
  mkdirSync(dirname(dest), { recursive: true });
  cpSync(src, dest);
  const bytes = readFileSync(dest).length;
  if (bytes === 0) fail(`빈 파일 복사됨: ${dest}`);
  files.push({ dest, bytes, sha256: sha256(dest).slice(0, 16) });
}

// gzip 매직(1F 8B) · wasm 매직(\0asm) sanity — 잘못된 파일을 조용히 두지 않는다.
for (const lang of ["kor", "eng"]) {
  const head = readFileSync(join(tesseractDir, `${lang}.traineddata.gz`)).subarray(0, 2);
  if (head[0] !== 0x1f || head[1] !== 0x8b) fail(`${lang} 언어팩이 gzip이 아닙니다.`);
}
{
  const head = readFileSync(join(tesseractDir, coreWasm)).subarray(0, 4);
  if (head[0] !== 0x00 || head[1] !== 0x61 || head[2] !== 0x73 || head[3] !== 0x6d) {
    fail("core wasm 매직이 아닙니다.");
  }
}

manifest.files = Object.fromEntries(
  files.map(({ dest, bytes, sha256: hash }) => [
    dest.slice(outDir.length + 1).replace(/\\/g, "/"),
    { bytes, sha256_16: hash },
  ]),
);
writeFileSync(join(outDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);

const total = files.reduce((sum, f) => sum + f.bytes, 0);
console.log("vendor:document-ocr OK");
for (const f of files) {
  console.log(`  ${(f.bytes / 1024 / 1024).toFixed(2)}MB  ${f.dest.slice(outDir.length + 1)}`);
}
console.log(`  total ${(total / 1024 / 1024).toFixed(2)}MB`);
